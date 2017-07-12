// @flow
import fetch from 'isomorphic-fetch';
import {login, validateSession} from './apiCalls';
import {clamp} from 'lodash';
import {burnItDown} from './utils';
import {getBurned} from './globals';
import type {ApiError} from 'types';

type FetchCallbacks = {
  onBurn?: () => void,
  onError?: (error: ?ApiError) => void,
  onRetryableError?: (error: ?ApiError) => void,
  onErrorResolved?: () => void,
};
let callbacks: FetchCallbacks = {};
export const registerCallbacks = (cbs: FetchCallbacks = {}) => {
  callbacks = Object.assign({}, callbacks, cbs);
};

let initialized = false;
export const onInit = () => {
  initialized = true;
};

const bypassUrls = ['/session/web', '/agents-available'];

let retryCount = 0;
let timedOut = false;
let timerId;
export default (url: string, fetchRequest: RequestOptions) => {
  const delayIfNeeded = () =>
    new Promise(resolve => {
      window.setTimeout(function() {
        resolve();
      }, clamp((retryCount ** 2 - 1) / 2 * 1000, 0, 30000));
    });

  return new Promise((resolve, reject) => {
    timerId = window.setTimeout(() => {
      timedOut = true;
      return reject(new Error('API call exceeded maximum time of 30 seconds'));
    }, 30000);

    const request = () => {
      if (!bypassUrls.find(u => url.includes(u)) && !initialized) {
        return reject(new Error('Attempted calling API without initializing chat client'));
      }
      if (getBurned()) {
        return reject(new Error('Client in bad state. Aborting call.'));
      }

      delayIfNeeded().then(() =>
        fetch(url, fetchRequest).then(
          response => {
            // Special Case
            if (response.status === 401) {
              if (
                url.includes('/session/web/generate') &&
                fetchRequest.method &&
                fetchRequest.method.toUpperCase() === 'POST'
              ) {
                if (callbacks.onError) {
                  callbacks.onError(response);
                }

                return reject(response);
              }

              if (callbacks.onRetryableError) {
                callbacks.onRetryableError();
              }

              return login().then(validateSession).then(request);
            }

            // Retry
            if (!timedOut && response.status >= 402 && response.status !== 422 && retryCount < 4) {
              if (callbacks.onRetryableError) {
                callbacks.onRetryableError();
              }

              retryCount++;
              return request();
            }

            window.clearTimeout(timerId);

            if (response.status === 466) {
              burnItDown();
              if (callbacks.onBurn) {
                callbacks.onBurn();
              }

              return reject();
            }

            // Success
            if (response.status < 400) {
              if (retryCount > 0 && callbacks.onErrorResolved) {
                callbacks.onErrorResolved();
              }

              // $FlowIssue flow is complaining that resolve takes a Response | Promise<Response>.  We are giving it a Response
              return resolve(response);
            }

            // Reject
            return reject(response);
          },
          error => {
            // We have no way of knowing status code if we get into this failed fetch state.
            // Try re-authing for good measure then retry the fetch.
            if (!timedOut && retryCount < 4) {
              if (
                url.includes('/session/web/generate') &&
                fetchRequest.method &&
                fetchRequest.method.toUpperCase() === 'POST'
              ) {
                if (callbacks.onError) {
                  callbacks.onError();
                }

                return reject();
              }

              if (callbacks.onRetryableError) {
                callbacks.onRetryableError();
              }

              retryCount++;
              return login().then(validateSession).then(request);
            }

            if (callbacks.onError) {
              callbacks.onError();
            }

            const err = error;
            err.status = 1000;
            window.clearTimeout(timerId);
            return reject(err);
          },
        ),
      );
    };
    request();
  });
};

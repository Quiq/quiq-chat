// @flow
import fetch from 'isomorphic-fetch';
import {login, validateSession} from './apiCalls';
import {clamp, merge} from 'lodash';
import {burnItDown} from './utils';
import {getBurned} from './globals';
import {getAccessToken} from './cookies';
import type {ApiError, IsomorphicFetchNetworkError} from 'types';

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

const bypassUrls = ['/generate', '/agents-available', '/chat'];

export default (url: string, fetchRequest: RequestOptions) => {
  let retryCount = 0;
  let timedOut = false;
  let timerId;

  const delayIfNeeded = () =>
    new Promise(resolve => {
      window.setTimeout(function() {
        resolve();
        // Exponential backoff with a cap of 30 seconds
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

      const req = fetchRequest;
      const accessToken = getAccessToken();
      if (accessToken) {
        req.headers = merge({}, req.headers, {
          'X-Quiq-Access-Token': accessToken,
        });
      }

      delayIfNeeded().then(() =>
        fetch(url, req).then(
          (response: Response) => {
            if (response.status === 466) {
              window.clearTimeout(timerId);
              burnItDown();
              if (callbacks.onBurn) {
                callbacks.onBurn();
              }

              return reject();
            }

            // Special Case
            if (response.status === 401) {
              if (
                url.includes('/session/web/generate') &&
                req.method &&
                req.method.toUpperCase() === 'POST'
              ) {
                if (callbacks.onError) {
                  callbacks.onError();
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

            // Success
            if (response.status < 400) {
              if (retryCount > 0 && callbacks.onErrorResolved) {
                callbacks.onErrorResolved();
              }

              return resolve(response);
            }

            // Reject
            return reject(response);
          },
          (error: IsomorphicFetchNetworkError) => {
            // We aren't given a status code in this code path.  If we didn't get here from an auth call,
            // try re-authing
            if (!timedOut && retryCount < 4) {
              if (
                url.includes('/session/web/generate') &&
                req.method &&
                req.method.toUpperCase() === 'POST'
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

            const err: IsomorphicFetchNetworkError = error;
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

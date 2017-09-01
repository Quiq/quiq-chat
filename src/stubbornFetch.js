// @flow
import fetch from 'isomorphic-fetch';
import {login} from './apiCalls';
import {clamp, merge} from 'lodash';
import {burnItDown} from './utils';
import {getBurned, getSessionApiUrl, getGenerateUrl} from './globals';
import {getAccessToken} from './storage';
import type {ApiError, IsomorphicFetchNetworkError} from 'types';

const messages = {
  maxTriesExceeded: 'API call exceeded maximum time of 30 seconds',
  clientNotInitialized: 'Attempted calling API without initializing chat client',
  burned: 'Client in bad state. Aborting call.',
  burnedInResponse: 'Client in bad state. Aborting response.',
  burnedFromServer: 'Received 466 response code from server. Blocking any further API Calls.',
  totalErrorsExceeded:
    'Client has exceeded maximum number of errors for a single session. Aborting session.',
  clientInactive: 'The client has been inactive for 30 minutes.  Blocking any further API Calls.',
};

type FetchCallbacks = {
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

let clientInactive = false;
export const setClientInactive = (isInactive: boolean) => {
  clientInactive = isInactive;
};

let errorCount = 0;
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

  const burnIt = () => {
    window.clearTimeout(timerId);
    burnItDown();
  };

  return new Promise((resolve, reject) => {
    timerId = window.setTimeout(() => {
      timedOut = true;
      if (callbacks.onError) callbacks.onError();
      return reject(new Error(messages.maxTriesExceeded));
    }, 30000);

    const request = () => {
      if (clientInactive) {
        return reject(new Error(messages.clientInactive));
      }
      if (!bypassUrls.find(u => url.includes(u)) && !initialized) {
        return reject(new Error(messages.clientNotInitialized));
      }
      if (getBurned()) {
        return reject(new Error(messages.burned));
      }
      if (errorCount > 100) {
        burnIt();
        return reject(new Error(messages.totalErrorsExceeded));
      }

      const req = fetchRequest;
      const accessToken = getAccessToken();
      if (accessToken) req.headers = merge({}, req.headers, {'X-Quiq-Access-Token': accessToken});

      delayIfNeeded().then(() =>
        fetch(url, req).then(
          (response: Response) => {
            if (getBurned()) return reject(messages.burnedInResponse);

            if (response.status === 466) {
              burnIt();
              return reject(new Error(messages.burnedFromServer));
            }

            // Special Case
            if (response.status === 401) {
              // If we get a 401 during the handshake, things went south.  Get us out of here, Chewy!
              if (url === getGenerateUrl() || url === getSessionApiUrl()) {
                burnIt();
                return reject(response);
              }

              if (callbacks.onRetryableError) callbacks.onRetryableError();
              errorCount++;
              return login().then(request);
            }

            // Retry
            if (!timedOut && response.status >= 402 && response.status !== 422 && retryCount < 4) {
              if (callbacks.onRetryableError) callbacks.onRetryableError();
              errorCount++;
              retryCount++;
              return request();
            }

            window.clearTimeout(timerId);

            // Success
            if (response.status < 400) {
              if (retryCount > 0 && callbacks.onErrorResolved) callbacks.onErrorResolved();
              return resolve(response);
            }

            // Reject
            if (callbacks.onError) callbacks.onError();
            return reject(response);
          },
          (error: IsomorphicFetchNetworkError) => {
            if (getBurned()) return reject(messages.burnedInResponse);

            // We aren't given a status code in this code path.  If we didn't get here from an auth call,
            // try re-authing
            if (!timedOut && retryCount < 4) {
              if (callbacks.onRetryableError) callbacks.onRetryableError();
              errorCount++;
              retryCount++;
              return request();
            }

            if (callbacks.onError) callbacks.onError();
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

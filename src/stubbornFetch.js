// @flow
import fetch from 'isomorphic-fetch';
import {login} from './apiCalls';
import clamp from 'lodash/clamp';
import merge from 'lodash/merge';
import {burnItDown} from './Utils/utils';
import {getBurned, getSessionApiUrl, getGenerateUrl} from './globals';
import {getAccessToken} from './storage';
import logger from 'logging';
import type {ApiError, IsomorphicFetchNetworkError} from 'types';

const log = logger('StubbornFetch');

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

const bypassUrls = ['/generate', '/agents-available', '/chat'];
let callbacks: FetchCallbacks = {};
let initialized = false;
let clientInactive = false;
let errorCount = 0;

export const registerCallbacks = (cbs: FetchCallbacks = {}) => {
  callbacks = Object.assign({}, callbacks, cbs);
};

export const onInit = () => {
  initialized = true;
};

export const setClientInactive = (isInactive: boolean) => {
  clientInactive = isInactive;
};

const logRequest = (logData: Object) => {
  if (logData._logged) return;
  // eslint-disable-next-line no-param-reassign
  logData._logged = true;

  const dataCopy = Object.assign({}, logData);

  // Redact access token
  if (dataCopy.fetchRequest && dataCopy.fetchRequest.headers) {
    delete dataCopy.fetchRequest.headers['X-Quiq-Access-Token'];
  }

  const statusCode =
    dataCopy.statusCode || (dataCopy.responses[0] && dataCopy.responses[0].statusCode);
  const reason = dataCopy.reason || (dataCopy.responses[0] && dataCopy.responses[0].statusText);
  log.debug(`[${statusCode}] (${reason}) ${dataCopy.url}`, {data: dataCopy, capture: true});
};

export default (url: string, fetchRequest: RequestOptions): Promise<*> => {
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
    const logData = {
      url,
      fetchRequest,
      retries: -1,
      responses: [],
      statusCode: 0,
      reason: '',
      startTime: Date.now(),
      _logged: false,
    };

    timerId = window.setTimeout(() => {
      timedOut = true;
      if (callbacks.onError) callbacks.onError();
      logData.statusCode = -1;
      logData.reason = 'Timed out';
      logRequest(logData);
      return reject(new Error(`${messages.maxTriesExceeded} ${url}`));
    }, 30000);

    const request = () => {
      logData.retries++;

      if (clientInactive) {
        logData.statusCode = -1;
        logData.reason = 'Request blocked because client is inactive';
        logRequest(logData);
        return reject(new Error(messages.clientInactive));
      }
      if (!bypassUrls.find(u => url.includes(u)) && !initialized) {
        log.warn(`Request to ${url} blocked because client is not yet initialized`, {
          data: logData,
        });
        return reject(new Error(messages.clientNotInitialized));
      }
      if (getBurned()) {
        logData.statusCode = -1;
        logData.reason = 'Client is burned';
        logRequest(logData);
        return reject(new Error(messages.burned));
      }
      if (errorCount > 100) {
        log.error('Max error count exceeded. Burning client.', {data: logData});
        burnIt();
        return reject(new Error(messages.totalErrorsExceeded));
      }

      const req = fetchRequest;
      const accessToken = getAccessToken();
      if (accessToken) req.headers = merge({}, req.headers, {'X-Quiq-Access-Token': accessToken});

      delayIfNeeded().then(() =>
        fetch(url, req).then(
          (response: Response) => {
            logData.responses.push({
              statusCode: response.status,
              statusText: response.statusText,
              type: response.type,
            });

            if (getBurned()) {
              logData.statusCode = -1;
              logData.reason = 'Got a response, but client has been burned';
              logRequest(logData);
              return reject(new Error(messages.burnedInResponse));
            }

            if (response.status === 466) {
              logRequest(logData);
              burnIt();
              return reject(new Error(messages.burnedFromServer));
            }

            // Special Case
            if (response.status === 401) {
              // If we get a 401 during the handshake, things went south.  Get us out of here, Chewy!
              if (url === getGenerateUrl() || url === getSessionApiUrl()) {
                log.error('Received 401 during login, burning', {data: logData});
                burnIt();
                return reject(new Error(response));
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

            // Log request
            logRequest(logData);

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
            logData.responses.push({
              statusCode: -1,
              statusText: 'IsomorphicFetchNetworkError',
            });

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
            logRequest(logData);
            return reject(err);
          },
        ),
      );
    };
    request();
  });
};

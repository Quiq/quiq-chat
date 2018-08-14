import fetch from 'isomorphic-fetch';
import { login } from './apiCalls';
import clamp from 'lodash/clamp';
import merge from 'lodash/merge';
import { burnItDown } from './Utils/utils';
import logger from './logging';
import ChatState from './State';
import { ApiError, FetchRequestOptions, IsomorphicFetchNetworkError } from './types';

const log = logger('StubbornFetch');

const messages = {
  maxTriesExceeded: 'API call exceeded maximum time of 30 seconds',
  clientNotInitialized: 'Attempted calling API without initializing chat client',
  burned: 'Client in bad state. Aborting call.',
  burnedInResponse: 'Client in bad state. Aborting response.',
  burnedFromServer: 'Received 466 response code from server. Blocking any further API Calls.',
  totalErrorsExceeded:
    'Client has exceeded maximum number of errors for a single session. Aborting session.',
};

interface FetchCallbacks {
  onError?: (error: ApiError) => void;
  onErrorResolved?: () => void;
}

interface LogData {
  _logged: boolean;
  statusCode?: number;
  reason?: string;
  url?: string;
  retries: number;
  startTime: number;
  fetchRequest?: FetchRequestOptions;
  responses: Array<{ statusText?: string; statusCode?: number; type?: string }>;
}

const bypassUrls = ['/generate', '/agents-available', '/chat'];
let callbacks: FetchCallbacks = {};
let initialized = false;
let errorCount = 0;

export const registerCallbacks = (cbs: FetchCallbacks = {}) => {
  callbacks = Object.assign({}, callbacks, cbs);
};

export const onInit = () => {
  initialized = true;
};

const logRequest = (logData: LogData) => {
  if (logData._logged) return;
  // eslint-disable-next-line no-param-reassign
  logData._logged = true;

  const dataCopy = Object.assign({}, logData);

  // Redact access token
  if (dataCopy.fetchRequest && dataCopy.fetchRequest.headers) {
    delete dataCopy.fetchRequest.headers['X-Quiq-Access-Token'];
  }

  const lastResponse =
    dataCopy.responses.length && dataCopy.responses[dataCopy.responses.length - 1];

  const statusCode = dataCopy.statusCode || (lastResponse && lastResponse.statusCode);
  const reason = dataCopy.reason || (lastResponse && lastResponse.statusText);
  log.debug(`[${statusCode}] (${reason}) ${dataCopy.url}`, { data: dataCopy, capture: true });
};

export default (url: string, fetchRequest: FetchRequestOptions): Promise<Response> => {
  let retryCount = 0;
  let timedOut = false;
  let timerId: number;

  const delayIfNeeded = () =>
    new Promise(resolve => {
      window.setTimeout(() => {
        resolve();
        // Exponential backoff with a cap of 30 seconds
      }, clamp((retryCount ** 2 - 1) / 2 * 1000, 0, 30000));
    });

  const burnIt = () => {
    window.clearTimeout(timerId);
    burnItDown();
  };

  return new Promise((resolve, reject) => {
    const logData: LogData = {
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
      if (callbacks.onError) callbacks.onError({});
      logData.statusCode = -1;
      logData.reason = 'Timed out';
      logRequest(logData);
      return reject(new Error(`${messages.maxTriesExceeded} ${url}`));
    }, 30000);

    const request = () => {
      logData.retries++;

      if (!bypassUrls.find(u => url.includes(u)) && !initialized) {
        log.warn(`Request to ${url} blocked because client is not yet initialized`, {
          data: logData,
        });
        return reject(new Error(messages.clientNotInitialized));
      }
      if (ChatState.burned) {
        logData.statusCode = -1;
        logData.reason = 'Client is burned';
        logRequest(logData);
        return reject(new Error(messages.burned));
      }
      if (errorCount > 100) {
        log.error('Max error count exceeded. Burning client.', { data: logData });
        burnIt();
        return reject(new Error(messages.totalErrorsExceeded));
      }

      const req = fetchRequest;
      const accessToken = ChatState.accessToken;
      if (accessToken) req.headers = merge({}, req.headers, { 'X-Quiq-Access-Token': accessToken });

      delayIfNeeded().then(() =>
        // @ts-ignore - we don't care that we're not using the correct enumeration for mode
        fetch(url, req).then(
          (response: Response) => {
            logData.responses.push({
              statusCode: response.status,
              statusText: response.statusText,
              type: response.type,
            });

            if (ChatState.burned) {
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
              if (url.includes('api/v1/token/generate')) {
                log.error('Received 401 during login, burning', { data: logData });
                burnIt();
                return reject(new Error('Received 401 during login, burning'));
              }

              errorCount++;
              return login().then(({ trackingId, oldTrackingId }) => {
                // Do NOT retry if tid changed--this is a new session, and any call we might be making was intended for old session
                if (oldTrackingId && trackingId !== oldTrackingId) {
                  log.warn('Tracking ID changed, not retrying after login.');
                  if (timerId) {
                    clearTimeout(timerId);
                  }
                  return reject(new Error('Tracking ID changed, not retrying after login.'));
                }
                request();
              });
            }

            // Retry
            if (!timedOut && response.status >= 402 && response.status !== 422 && retryCount < 4) {
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
            if (callbacks.onError) callbacks.onError({});
            return reject(response);
          },
          (error: IsomorphicFetchNetworkError) => {
            logData.responses.push({
              statusCode: -1,
              statusText: 'IsomorphicFetchNetworkError',
            });

            if (ChatState.burned) return reject(messages.burnedInResponse);

            // We aren't given a status code in this code path.  If we didn't get here from an auth call,
            // try re-authing
            if (!timedOut && retryCount < 4) {
              errorCount++;
              retryCount++;
              return request();
            }

            if (callbacks.onError) callbacks.onError({});
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

import StubbornFetch, { StubbornFetchError } from 'stubborn-fetch';
import { login } from './apiCalls';
import merge from 'lodash/merge';
import { burnItDown, formatQueryParams, createGuid, getTimezone } from './Utils/utils';
import { version } from '../package.json';
import logging from './logging';
import ChatState from './State';
import { ApiError, FetchRequestOptions } from './types';

interface FetchCallbacks {
  onError?: (error: ApiError | StubbornFetchError | undefined) => void;
  onErrorResolved?: () => void;
}

interface LogData {
  response?: Response;
  error?: StubbornFetchError;
}

interface FailureLogEntry {
  statusCode: number;
  errorType: string;
}

const messages = {
  burned: 'Client in bad state. Aborting call.',
  burnedFromServer: 'Received 466 response code from server. Blocking any further API Calls.',
  storageDisabled: 'Storage is not enabled, aborting call',
  trackingIdChanged: 'Tracking ID changed, not retrying after login.',
  cannotParseResponse: (url: string) => `Couldn't parse API response from ${url}`,
  unknownError: (url: string) => `Unknown error while parsing ${url}`,
};

const quiqFetchLog = logging('QuiqFetch');

const checkRequiredSettings = () => {
  if (ChatState.burned) {
    throw new Error('Client in bad state. Aborting call.');
  }

  if (!ChatState.host || !ChatState.contactPoint) {
    throw new Error(
      `
      HOST and CONTACT_POINT must be configured to call Quiq Messaging.
      Did you forget to call init?
      `,
    );
  }
};

const scrubRequest = (req: FetchRequestOptions): Object => {
  const reqCopy = Object.assign({}, req);
  // Redact access token
  if (reqCopy.headers && reqCopy.headers['X-Quiq-Access-Token']) {
    reqCopy.headers['X-Quiq-Access-Token'] = '<redacted>';
  }
  return reqCopy;
};

const scrubError = (e: StubbornFetchError): StubbornFetchError => {
  const dataCopy = Object.assign({}, e.data);
  if (dataCopy.request) {
    dataCopy.request = scrubRequest(dataCopy.request);
  }

  return { ...e, data: dataCopy };
};

const logger = {
  log: quiqFetchLog.info,
  debug: quiqFetchLog.debug,
  info: quiqFetchLog.info,
  warn: (msg: string, context: LogData = {}) => {
    // We don't care about 401's in chat
    quiqFetchLog.warn(msg, {
      context,
      capture: !(context && context.response && context.response.status === 401),
      logOptions: {
        logFirstOccurrence: true,
        frequency: 'session',
      },
    });
  },
  error: (msg: string, data: LogData = {}) => {
    quiqFetchLog.error(msg, {
      context: data.error && scrubError(data.error),
      capture: !(
        data &&
        data.error &&
        data.error.data &&
        data.error.data.response &&
        data.error.data.response.status &&
        data.error.data.response.status === 401
      ),
      logOptions: {
        logFirstOccurrence: true,
        frequency: 'session',
      },
    });
  },
};

let callbacks: FetchCallbacks = {};

export const registerCallbacks = (cbs: FetchCallbacks) => {
  callbacks = Object.assign({}, callbacks, cbs);
};

const quiqFetch = (
  url: string,
  overrides?: Object,
  fetchOptions: {
    requestType?: string;
    responseType?: string;
    checkRequiredSettings?: boolean;
    cached?: boolean;
    shouldRetry?: boolean;
    failSilently?: boolean;
  } = {
    cached: false,
    requestType: 'JSON',
    responseType: 'NONE',
    checkRequiredSettings: true,
    shouldRetry: true,
    failSilently: false,
  },
): Promise<any> => {
  if (ChatState.burned) {
    return Promise.reject(new Error(messages.burned));
  }

  const options = Object.assign(
    {
      shouldRetry: true,
      failSilently: false,
    },
    fetchOptions,
  );

  if (options.checkRequiredSettings) checkRequiredSettings();

  const correlationId = createGuid();
  // Only append this data to a non-cached endpoint so we don't cache bust.
  const parsedUrl = options.cached
    ? url
    : formatQueryParams(url, {
        trackingId: ChatState.trackingId || 'noAssociatedTrackingId',
        quiqVersion: version,
      });

  let request: FetchRequestOptions = {
    // Leave this as cors even though we are on same origin for default webchat case.
    // If anyone were to use quiq-chat directly without webchat, it would be on a non-goquiq.com domain.
    // It also allows us to test our webchat as if it were cors enabled, even though we do not use
    // cors capabilities.
    mode: 'cors',
    correlationId,
    headers: {},
    method: 'GET',
  };

  request.headers = Object.assign(
    {},
    {
      'X-Quiq-Line': '2',
      'X-Quiq-Client-Id': 'Quiq-Chat-Client',
      'X-Quiq-Client-Version': version,
      'x-centricient-correlation-id': correlationId,
      'X-Quiq-Access-Token': ChatState.accessToken,
    },
    options.requestType === 'JSON'
      ? { Accept: 'application/json', 'Content-Type': 'application/json' }
      : {},
    getTimezone() ? { 'X-Quiq-Time-Zone': getTimezone() } : {},
    ChatState.context && ChatState.context.href
      ? { 'X-Quiq-Referrer': ChatState.context.href }
      : {},
  );

  if (overrides) {
    request = merge(request, overrides);
  }

  const failures: Array<FailureLogEntry> = [];

  const onError = (e: StubbornFetchError) => {
    failures.push({
      statusCode: e.data && e.data.response && e.data.response.status,
      errorType: e.type,
    });

    if (e.data && e.data.response && e.data.response.status) {
      const { status } = e.data.response;

      if (status === 466 || (status === 401 && url.includes('api/v1/token/generate'))) {
        burnItDown();
        return true;
      }
    }

    switch (e.type) {
      case StubbornFetchError.types.MAX_ERRORS_EXCEEDED:
      case StubbornFetchError.types.RATE_LIMITED:
        burnItDown();
        return true;
      default:
        return false;
    }
  };

  return new StubbornFetch(parsedUrl, request, {
    retries: options.shouldRetry ? -1 : 0,
    maxErrors: 100,
    retryOnNetworkFailure: true,
    totalRequestTimeLimit: 30000,
    onError,
    logger,
    minimumStatusCodeForRetry: 500,
  })
    .send()
    .then(
      (res: Response): any => {
        // Log this request to sentry
        const data = {
          statusCode: res.status,
          reason: res.statusText,
          request: scrubRequest(request),
          url: parsedUrl,
          failures,
        };
        quiqFetchLog.debug(`[${data.statusCode}] (${data.reason}) ${data.url}`, {
          context: data,
          capture: true,
        });

        if (options.responseType === 'JSON' && res && res.json) {
          return res
            .json()
            .then(result => result)
            .catch(err => {
              quiqFetchLog.warn(messages.cannotParseResponse(parsedUrl), {
                exception: err,
                logOptions: {
                  logFirstOccurrence: true,
                  frequency: 'session',
                },
              });
              return err;
            });
        }

        if (options.responseType === 'NONE') {
          return Promise.resolve();
        }

        return res;
      },
    )
    .catch((error: StubbornFetchError) => {
      if (!error) return Promise.reject(new Error(messages.unknownError(parsedUrl)));

      if (options.failSilently) {
        return Promise.reject(error);
      }

      if (onError(error)) {
        if (callbacks.onError) callbacks.onError(error);

        return Promise.reject(new Error(messages.burned));
      }

      if (
        error.type === StubbornFetchError.types.HTTP_ERROR &&
        error.data &&
        error.data.response &&
        error.data.response.status &&
        error.data.response.status === 401
      ) {
        return login()
          .then(({ trackingId, oldTrackingId }) => {
            // Do NOT retry if tid changed--this is a new session, and any call we might be making was intended for old session
            if (oldTrackingId && trackingId !== oldTrackingId) {
              logger.warn(messages.trackingIdChanged);
              return Promise.reject(error);
            }

            return quiqFetch(url, overrides, options);
          })
          .catch(err => Promise.reject(err));
      }

      if (callbacks.onError) callbacks.onError(error);
      return Promise.reject(error);
    });
};

export default quiqFetch;

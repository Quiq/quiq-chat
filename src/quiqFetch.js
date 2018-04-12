// @flow
import oldStubbornFetch from './stubbornFetch';
import StubbornFetch, {StubbornFetchError} from 'stubborn-fetch';
import {checkRequiredSettings, getSessionApiUrl, getGenerateUrl, getBurned} from './globals';
import {isStorageEnabled, getTrackingId, getAccessToken} from './storage';
import {login} from './apiCalls';
import merge from 'lodash/merge';
import {burnItDown, formatQueryParams, createGuid} from './Utils/utils';
import {version} from '../package.json';
import logging from './logging';

const messages = {
  burned: 'Client in bad state. Aborting call.',
  burnedFromServer: 'Received 466 response code from server. Blocking any further API Calls.',
  storageDisabled: 'Storage is not enabled, aborting call',
  trackingIdChanged: 'Tracking ID changed, not retrying after login.',
  cannotParseResponse: (url: string) => `Couldn't parse API response from ${url}`,
  unknownError: (url: string) => `Unknown error while parsing ${url}`,
};

const quiqFetchLog = logging('QuiqFetch');
const logger = {
  log: quiqFetchLog.log,
  info: quiqFetchLog.info,
  warn: quiqFetchLog.warn,
  error: (msg: string, e: StubbornFetchError) =>
    quiqFetchLog.error(
      msg,
      e,
      e &&
        e.error &&
        e.error.data &&
        e.error.data.response &&
        e.error.data.response.status &&
        e.error.data.response.status >= 400 &&
        e.error.data.response.status < 500,
    ),
};

let fetchMode;
export const setFetchMode = (mode?: 'edge' | 'legacy') => {
  fetchMode = mode;
};

const quiqFetch = (
  url: string,
  overrides?: Object,
  options?: {
    requestType?: string,
    responseType?: string,
    checkRequiredSettings?: boolean,
    cached?: boolean,
  } = {
    cached: false,
    requestType: 'JSON',
    responseType: 'NONE',
    checkRequiredSettings: true,
  },
): Promise<*> => {
  if (!isStorageEnabled()) {
    return Promise.reject(new Error(messages.storageDisabled));
  }

  if (getBurned()) {
    return Promise.reject(new Error(messages.burned));
  }

  if (options.checkRequiredSettings) checkRequiredSettings();

  const correlationId = createGuid();
  // Only append this data to a non-cached endpoint so we don't cache bust.
  const parsedUrl = options.cached
    ? url
    : formatQueryParams(url, {
        trackingId: getTrackingId() || 'noAssociatedTrackingId',
        quiqVersion: version,
      });

  let request: RequestOptions = {
    // Leave this as cors even though we are on same origin for default webchat case.
    // If anyone were to use quiq-chat directly without webchat, it would be on a non-goquiq.com domain.
    // It also allows us to test our webchat as if it were cors enabled, even though we do not use
    // cors capabilities.
    mode: 'cors',
    correlationId,
  };

  request.method = request.method || 'GET';
  request.headers = Object.assign(
    {},
    {
      'X-Quiq-Line': '2',
      'X-Quiq-Client-Id': 'Quiq-Chat-Client',
      'X-Quiq-Client-Version': version,
      'x-centricient-correlation-id': correlationId,
      'X-Quiq-Access-Token': getAccessToken(),
    },
    options.requestType === 'JSON'
      ? {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        }
      : {},
  );

  if (overrides) {
    request = merge(request, overrides);
  }

  if (!fetchMode || fetchMode === 'legacy') {
    return oldStubbornFetch(parsedUrl, request)
      .then((res: Promise<Response> | Response): any => {
        if (options.responseType === 'JSON' && res && res.json) {
          return ((res: any): Response)
            .json()
            .then(result => result)
            .catch(err => {
              logger.warn(messages.cannotParseResponse(parsedUrl), {exception: err});
              return err;
            });
        } else if (options.responseType === 'NONE') {
          return;
        }

        return res;
      })
      .catch(err => {
        return Promise.reject(err);
      });
  }

  const onError = (e: StubbornFetchError) => {
    if (e.data && e.data.response && e.data.response.status) {
      const {status} = e.data.response;

      if (
        status === 466 ||
        (status === 401 && (url === getGenerateUrl() || url === getSessionApiUrl()))
      ) {
        burnItDown();
        return true;
      }
    }

    switch (e.type) {
      case StubbornFetchError.types.MAX_ERRORS_EXCEEDED:
      case StubbornFetchError.types.RATE_LIMITED:
        burnItDown();
        return true;
    }

    return false;
  };

  return new StubbornFetch(parsedUrl, request, {
    retries: -1,
    maxErrors: 100,
    retryOnNetworkFailure: true,
    totalRequestTimeLimit: 30000,
    onError,
    logger,
    minimumStatusCodeForRetry: 402,
  })
    .send()
    .then((res: Promise<Response> | Response): any => {
      if (options.responseType === 'JSON' && res && res.json) {
        return ((res: any): Response)
          .json()
          .then(result => result)
          .catch(err => {
            logger.warn(messages.cannotParseResponse(parsedUrl), {exception: err});
            return err;
          });
      } else if (options.responseType === 'NONE') {
        return;
      }

      return res;
    })
    .catch(error => {
      if (!error) return Promise.reject(new Error(messages.unknownError(parsedUrl)));

      if (onError(error)) {
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
          .then(({trackingId, oldTrackingId}) => {
            // Do NOT retry if tid changed--this is a new session, and any call we might be making was intended for old session
            if (oldTrackingId && trackingId !== oldTrackingId) {
              logger.warn(messages.trackingIdChanged);
              return Promise.reject(new Error(error));
            }

            return quiqFetch(url, overrides, options);
          })
          .catch(err => Promise.reject(err));
      }

      return Promise.reject(error);
    });
};

export default quiqFetch;

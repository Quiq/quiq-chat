// @flow
import stubbornFetch from './stubbornFetch';
import {checkRequiredSettings} from './globals';
import {isStorageEnabled, getTrackingId} from './storage';
import merge from 'lodash/merge';
import {formatQueryParams, createGuid} from './Utils/utils';
import {version} from '../package.json';
import logger from './logging';

const log = logger('QuiqFetch');

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
    return Promise.reject('Storage is not enabled, aborting call');
  }

  if (options.checkRequiredSettings) checkRequiredSettings();

  const correlationId = createGuid();
  // Only append this data to a non-cached endpoint so we don't cache bust.
  let parsedUrl = options.cached
    ? url
    : formatQueryParams(url, {
        trackingId: getTrackingId() || 'noAssociatedTrackingId',
        quiqVersion: version,
      });
  parsedUrl = `${parsedUrl}#correlationId=${correlationId}`;

  let request: RequestOptions = {
    // Leave this as cors even though we are on same origin for default webchat case.
    // If anyone were to use quiq-chat directly without webchat, it would be on a non-goquiq.com domain.
    // It also allows us to test our webchat as if it were cors enabled, even though we do not use
    // cors capabilities.
    mode: 'cors',
    headers: {
      'X-Quiq-Line': '2',
      'X-Quiq-Client-Id': 'Quiq-Chat-Client',
      'X-Quiq-Client-Version': version,
      'x-centricient-correlation-id': correlationId,
    },
  };

  let headers = {};
  if (options.requestType === 'JSON' && request.headers) {
    headers = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    };
  }

  if (overrides) {
    request.headers = merge(request.headers, headers);
    request = merge(request, overrides);
  }

  request.method = request.method || 'GET';
  return stubbornFetch(parsedUrl, request)
    .then((res: Promise<Response> | Response): any => {
      if (options.responseType === 'JSON' && res && res.json) {
        return ((res: any): Response)
          .json()
          .then(result => result)
          .catch(err => {
            log.warn(`Couldn't parse API response from ${parsedUrl}`, {exception: err});
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
};

export default quiqFetch;

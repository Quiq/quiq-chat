// @flow
import stubbornFetch from './stubbornFetch';
import {checkRequiredSettings} from './globals';
import {merge} from 'lodash';
import {version} from '../package.json';

const quiqFetch = (
  url: string,
  overrides?: Object,
  options?: {
    requestType?: string,
    responseType?: string,
    checkRequiredSettings?: boolean,
  } = {
    requestType: 'JSON',
    responseType: 'NONE',
    checkRequiredSettings: true,
  },
) => {
  if (options.checkRequiredSettings) checkRequiredSettings();

  let request: RequestOptions = {
    mode: 'cors',
    headers: {
      'X-Quiq-Line': '1',
      'X-Quiq-Client-Id': 'Quiq-Chat-Client',
      'X-Quiq-Client-Version': version,
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

  return stubbornFetch(url, request)
    .then((res: Promise<Response> | Response): any => {
      if (options.responseType === 'JSON' && res && res.json) {
        return ((res: any): Response).json().then(result => result).catch(err => err);
      } else if (options.responseType === 'NONE') {
        return;
      }

      return res;
    })
    .catch(err => err);
};

export default quiqFetch;

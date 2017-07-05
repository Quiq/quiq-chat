// @flow
import fetch from 'isomorphic-fetch';
import {burnItDown} from './utils';
import {getBurned} from './globals';
import {merge} from 'lodash';

const quiqFetch = (url: string, overrides?: Object, requestType: ?string = 'JSON') => {
  if (getBurned()) return Promise.reject();

  let request: RequestOptions = {
    mode: 'cors',
    headers: {
      'X-Quiq-Line': '1',
    },
  };

  let headers = {};
  if (requestType === 'JSON' && request.headers) {
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

  return fetch(url, request)
    .then(res => {
      if (res.status === 466) {
        burnItDown();
      }
      return res;
    })
    .catch(err => {
      if (err.status === 466) {
        burnItDown();
      }

      return err;
    });
};

export default quiqFetch;

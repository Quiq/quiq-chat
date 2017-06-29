// @flow
import isomorphicFetch from 'isomorphic-fetch';
import {burnItDown} from './utils';
import {getBurned} from './globals';

const fetch = (url: string, overrides?: Object, requestType: ?string = 'JSON') => {
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
    request = Object.assign({}, request, overrides);
    request.headers = Object.assign({}, request.headers, headers);
  }

  request.method = request.method || 'GET';
  return isomorphicFetch(url, request)
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

export default fetch;

jest.mock('../../logging');
jest.mock('../../Utils/utils.js');

import {isStorageEnabled} from '../index';

describe('isStorageEnabled', () => {
  it('fails if localStorage is disabled', () => {
    window.localStorage = {
      getItem: () => {
        throw new Error('getItem');
      },
      setItem: () => {
        throw new Error('setItem');
      },
      clear: () => {
        throw new Error('clear');
      },
      removeItem: () => {
        throw new Error('removeItem');
      },
    };

    expect(isStorageEnabled()).toBe(false);
  });
});

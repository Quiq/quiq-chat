jest.mock('../../logging');
jest.mock('../../Utils/utils');
jest.mock('../../State');

import {isStorageEnabled} from '../index';

describe('isStorageEnabled', () => {
  it('fails if localStorage is disabled', () => {
    // @ts-ignore
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

jest.mock('../../logging');
jest.mock('../../Utils/utils');
jest.mock('../../State');

import {isStorageEnabled} from '../index';

describe('isStorageEnabled', () => {
  it('fails if localStorage is disabled', () => {
    // @ts-ignore localStorage has been mocked globally
    localStorage.setItem.mockImplementationOnce(() => { throw new Error('mocked disabled') });

    expect(isStorageEnabled()).toBe(false);
  });
});

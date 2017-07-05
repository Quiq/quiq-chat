// @flow
jest.mock('isomorphic-fetch');
jest.mock('../utils');
jest.mock('../globals');
import iso from 'isomorphic-fetch';
import quiqFetch from '../quiqFetch';

describe('quiqFetch', () => {
  beforeEach(() => {
    iso.mockReturnValue({then: () => ({catch: jest.fn()})});
  });

  afterEach(() => {
    iso.mockClear();
  });

  it('transforms data', () => {
    quiqFetch('someUrl');
    expect(iso.mock.calls[0][0]).toBe('someUrl');
    expect(iso.mock.calls[0][1]).toMatchSnapshot();
  });

  it('respects overrides', () => {
    quiqFetch('someUrl', {
      headers: {
        customHeader: 'hi',
      },
      customProp: 'crazy',
    });
    expect(iso.mock.calls[0][1]).toMatchSnapshot();
  });

  it('respects requestType', () => {
    quiqFetch('someUrl', undefined, 'crazyRequestType');
    expect(iso.mock.calls[0][1]).toMatchSnapshot();
  });
});

// @flow
jest.mock('../stubbornFetch');
jest.mock('../utils');
jest.mock('../globals');
import fetch from '../stubbornFetch';
import quiqFetch from '../quiqFetch';

describe('quiqFetch', () => {
  const mockFetch = (fetch: any);

  beforeEach(() => {
    mockFetch.mockReturnValue({then: () => ({catch: jest.fn()})});
  });

  afterEach(() => {
    mockFetch.mockClear();
  });

  it('transforms data', () => {
    quiqFetch('someUrl');
    expect(mockFetch.mock.calls[0][0]).toBe('someUrl');
    expect(mockFetch.mock.calls[0][1]).toMatchSnapshot();
  });

  it('respects overrides', () => {
    quiqFetch('someUrl', {
      headers: {
        customHeader: 'hi',
      },
      customProp: 'crazy',
    });
    expect(mockFetch.mock.calls[0][1]).toMatchSnapshot();
  });

  it('respects requestType', () => {
    quiqFetch('someUrl', undefined, {requestType: 'crazyRequestType'});
    expect(mockFetch.mock.calls[0][1]).toMatchSnapshot();
  });
});

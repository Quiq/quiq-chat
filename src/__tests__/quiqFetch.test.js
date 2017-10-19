// @flow
jest.mock('../stubbornFetch');
jest.mock('../Utils/utils');
jest.mock('../globals');
jest.mock('../../package.json');
jest.mock('../storage');
jest.mock('../logging');
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
    expect(mockFetch.mock.calls[0][1].mode).toBe('cors');
    expect(mockFetch.mock.calls[0][1].method).toBe('GET');
    expect(mockFetch.mock.calls[0][1].headers['X-Quiq-Line']).toBe('2');
    expect(mockFetch.mock.calls[0][1].headers['X-Quiq-Client-Id']).toBe('Quiq-Chat-Client');
    expect(mockFetch.mock.calls[0][1].headers['X-Quiq-Client-Version']).toBeDefined();
  });

  it('respects overrides', () => {
    quiqFetch('someUrl', {
      headers: {
        customHeader: 'hi',
      },
      customProp: 'crazy',
    });
    expect(mockFetch.mock.calls[0][1].headers.customHeader).toBe('hi');
    expect(mockFetch.mock.calls[0][1].customProp).toBe('crazy');
  });

  it('respects requestType', () => {
    quiqFetch('someUrl', undefined, {requestType: 'crazyRequestType'});
    expect(mockFetch.mock.calls[0][1].headers.Accept).toBeUndefined();
  });
});

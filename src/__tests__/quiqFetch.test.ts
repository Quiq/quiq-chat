jest.mock('../stubbornFetch');
jest.mock('../Utils/utils');
jest.mock('../../package.json');
jest.mock('../storage');
jest.mock('../logging');

import fetch from '../stubbornFetch';
import quiqFetch from '../quiqFetch';
import ChatState from '../State';

describe('quiqFetch', () => {
  const mockFetch = <any>fetch;
  beforeEach(() => {
    mockFetch.mockReturnValue({ then: () => ({ catch: jest.fn() }) });

    ChatState.host = 'https://homer.goquiq.com';
    ChatState.contactPoint = 'default';
  });

  afterEach(() => {
    mockFetch.mockClear();
  });

  it('transforms data', () => {
    quiqFetch('someUrl');
    expect(mockFetch.mock.calls[0][0].split('#')[0]).toBe('someUrl');
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
    quiqFetch('someUrl', undefined, { requestType: 'crazyRequestType' });
    expect(mockFetch.mock.calls[0][1].headers.Accept).toBeUndefined();
  });
});

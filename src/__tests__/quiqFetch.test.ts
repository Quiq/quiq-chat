jest.mock('../Utils/utils');
jest.mock('../../package.json');
jest.mock('../storage');
jest.mock('../logging');

import { parseUrl } from '../Utils/utils';
import StubbornFetch from 'stubborn-fetch';
import quiqFetch from '../quiqFetch';
import ChatState, { initialize as initializeState, reset as resetState } from '../State';

describe('quiqFetch', () => {
  const stubbornFetch = <any>StubbornFetch;

  beforeAll(() => {
    initializeState();
  });

  beforeEach(() => {
    resetState();
    ChatState.host = parseUrl('https://homer.goquiq.com');
    ChatState.contactPoint = 'default';
  });

  afterEach(() => {
    stubbornFetch.mockClear();
  });

  it('transforms data', () => {
    quiqFetch('someUrl');
    expect(stubbornFetch.mock.calls[0][0].split('#')[0]).toBe('someUrl');
    expect(stubbornFetch.mock.calls[0][1].mode).toBe('cors');
    expect(stubbornFetch.mock.calls[0][1].method).toBe('GET');
    expect(stubbornFetch.mock.calls[0][1].headers['X-Quiq-Line']).toBe('2');
    expect(stubbornFetch.mock.calls[0][1].headers['X-Quiq-Client-Id']).toBe('Quiq-Chat-Client');
    expect(stubbornFetch.mock.calls[0][1].headers['X-Quiq-Client-Version']).toBeDefined();
  });

  it('respects overrides', () => {
    quiqFetch('someUrl', {
      headers: {
        customHeader: 'hi',
      },
      customProp: 'crazy',
    });
    expect(stubbornFetch.mock.calls[0][1].headers.customHeader).toBe('hi');
    expect(stubbornFetch.mock.calls[0][1].customProp).toBe('crazy');
  });

  it('respects requestType', () => {
    quiqFetch('someUrl', undefined, { requestType: 'crazyRequestType' });
    expect(stubbornFetch.mock.calls[0][1].headers.Accept).toBeUndefined();
  });
});

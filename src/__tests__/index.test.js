// @flow
jest.mock('../globals');
jest.mock('../apiCalls');
jest.mock('../websockets');
import * as Quiq from '../index';
import {setGlobals} from '../globals';
import {fetchWebsocketInfo} from '../apiCalls';
import {connectSocket} from '../websockets';

describe('quiq-chat', () => {
  describe('init', () => {
    it('calls setGlobals', () => {
      Quiq.init({HOST: 'testhost', CONTACT_POINT: 'test'});
      expect(setGlobals).toBeCalledWith({HOST: 'testhost', CONTACT_POINT: 'test'});
    });

    it('applies defaults', () => {
      Quiq.init({HOST: 'testhost'});
      expect(setGlobals).toBeCalledWith({HOST: 'testhost', CONTACT_POINT: 'default'});
    });
  });

  describe('subscribe', () => {
    const callbacks = {
      onConnectionLoss() {},
      onConnectionEstablish() {},
      handleMessage() {},
    };

    beforeEach(() => {
      const mockFetchWebsocketInfo = (fetchWebsocketInfo: any);
      mockFetchWebsocketInfo.mockReturnValue(Promise.resolve({url: 'www.fakesite.com'}));
      Quiq.subscribe(callbacks);
    });

    it('calls connectSocket', () => {
      expect(connectSocket).toBeCalledWith({socketUrl: 'www.fakesite.com', options: callbacks});
    });
  });
});

// NOTE: Not adding tests for the API call passthroughs right now. If you want to, go for it

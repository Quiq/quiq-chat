// @flow
jest.mock('../globals');
jest.mock('../apiCalls');
jest.mock('../websockets');
import * as Quiq from '../index';
import {setGlobals, isActive} from '../globals';
import {fetchWebsocketInfo, login} from '../apiCalls';
import {connectSocket} from '../websockets';

describe('quiq-chat', () => {
  beforeEach(() => {
    const mockLogin = (login: any);
    mockLogin.mockReturnValue(Promise.resolve());
    const mockIsActive = (isActive: any);
    mockIsActive.mockReturnValue(false);
  });

  describe('init', () => {
    it('applies defaults', async () => {
      await Quiq.init({HOST: 'testhost'});
      expect(setGlobals).toBeCalledWith({ACTIVE: true, HOST: 'testhost', CONTACT_POINT: 'default'});
    });

    it('calls setGlobals', async () => {
      await Quiq.init({HOST: 'testhost', CONTACT_POINT: 'test'});
      expect(setGlobals).toBeCalledWith({ACTIVE: true, HOST: 'testhost', CONTACT_POINT: 'test'});
    });
  });

  describe('subscribe', () => {
    const callbacks = {
      onConnectionLoss() {},
      onConnectionEstablish() {},
      onMessage() {},
    };

    beforeEach(() => {
      const mockFetchWebsocketInfo = (fetchWebsocketInfo: any);
      mockFetchWebsocketInfo.mockReturnValue(Promise.resolve({url: 'www.fakesite.com'}));
      Quiq.subscribe(callbacks);
    });

    it('calls connectSocket', () => {
      expect(connectSocket).toBeCalledWith({socketUrl: 'www.fakesite.com', callbacks});
    });
  });
});

// @flow
jest.mock('atmosphere.js');
import * as Websockets from '../websockets';
import atmosphere from 'atmosphere.js';

describe('Websockets', () => {
  const socketUrl = 'www.fakesite.com';
  const callbacks = {
    onConnectionLoss: jest.fn(),
    onConnectionEstablish: jest.fn(),
    onMessage: jest.fn(),
    onTransportFailure: jest.fn(),
    onClose: jest.fn(),
  };

  describe('connectSocket', () => {
    let buildRequest;

    beforeEach(() => {
      atmosphere.subscribe = jest.fn(request => {
        buildRequest = request;

        return {request: {}};
      });
      atmosphere.util = {
        parseJSON: JSON.parse,
      };
      Websockets.connectSocket({socketUrl, callbacks});
    });

    it('calls subscribe on atmosphere', () => {
      expect(atmosphere.subscribe).toBeCalled();
    });

    describe('events', () => {
      describe('onOpen', () => {
        beforeEach(() => {
          buildRequest.onOpen({request: {uuid: 'uuid'}});
        });

        it('calls onConnectionEstablish', () => {
          expect(callbacks.onConnectionEstablish).toBeCalled();
        });
      });

      describe('onClose', () => {
        beforeEach(() => {
          buildRequest.onClose();
        });

        it('calls onClose callback', () => {
          expect(callbacks.onClose).toBeCalled();
        });
      });

      describe('onReopen', () => {
        beforeEach(() => {
          buildRequest.onReopen();
        });

        it('calls onConnectionEstablish callback', () => {
          expect(callbacks.onConnectionEstablish).toBeCalled();
        });
      });

      describe('onMessage', () => {
        const message = {
          data: {favoriteNumber: 7},
          messageType: 'Text',
          tenantId: 'test',
        };

        beforeEach(() => {
          buildRequest.onMessage({
            responseBody: JSON.stringify(message),
          });
        });

        it('calls onMessage callback', () => {
          expect(callbacks.onMessage).toBeCalledWith(message);
        });
      });

      describe('onTransportFailure', () => {
        beforeEach(() => {
          buildRequest.onTransportFailure('uh oh', buildRequest);
        });

        it('calls onTransportFailure callback', () => {
          expect(callbacks.onTransportFailure).toBeCalledWith('uh oh', buildRequest);
        });
      });

      describe('onError', () => {
        beforeEach(() => {
          buildRequest.onError();
        });

        it('calls onConnectionLoss callback', () => {
          expect(callbacks.onConnectionLoss).toBeCalled();
        });
      });

      describe('onClientTimeout', () => {
        beforeEach(() => {
          buildRequest.onClientTimeout();
        });

        it('calls onConnectionLoss callback', () => {
          expect(callbacks.onConnectionLoss).toBeCalled();
        });
      });
    });
  });
});

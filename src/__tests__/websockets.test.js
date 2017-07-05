// @flow
jest.mock('atmosphere.js');
jest.mock('../utils');
import * as Websockets from '../websockets';
import * as Utils from '../utils';
import atmosphere from 'atmosphere.js';

describe('Websockets', () => {
  const socketUrl = 'www.fakesite.com';
  const callbacks = {
    onConnectionLoss: jest.fn(),
    onConnectionEstablish: jest.fn(),
    onMessage: jest.fn(),
    onTransportFailure: jest.fn(),
    onClose: jest.fn(),
    onBurn: jest.fn(),
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
        let message;
        beforeEach(() => {
          message = {
            data: {favoriteNumber: 7},
            messageType: 'Text',
            tenantId: 'test',
          };
        });

        it('calls onMessage callback', () => {
          buildRequest.onMessage({
            responseBody: JSON.stringify(message),
          });
          expect(callbacks.onMessage).toBeCalledWith(message);
        });

        describe('burnItDown message', () => {
          it('calls burnItDown', () => {
            message.messageType = 'BurnItDown';
            buildRequest.onMessage({
              responseBody: JSON.stringify(message),
            });
            expect(Utils.burnItDown).toBeCalledWith(message.data);
            expect(callbacks.onBurn).toBeCalledWith(message.data);
          });
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

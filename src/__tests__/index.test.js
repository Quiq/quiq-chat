// @flow
jest.mock('../apiCalls');
jest.mock('../websockets');
jest.mock('../storage');
jest.mock('store');
jest.mock('../Utils/utils');
jest.mock('../logging');
jest.mock('../QuiqSockets/quiqSockets');

import QuiqChatClient from '../index';
import * as ApiCalls from '../apiCalls';
import * as storage from '../storage';
import {connectSocket, disconnectSocket} from '../websockets';
import {set} from 'store';
import * as Utils from '../Utils/utils';
import log from 'loglevel';

log.setLevel('debug');

const initialConvo = {
  id: 'testConvo',
  subscribed: true,
  registered: false,
  messages: [
    {
      authorType: 'Customer',
      text: 'Marco',
      id: 'msg1',
      timestamp: 1,
      type: 'Text',
    },
    {
      authorType: 'User',
      text: 'Polo',
      id: 'msg2',
      timestamp: 2,
      type: 'Text',
    },
  ],
};

const testTrackingId = 'dsafdsafaweufh';
describe('QuiqChatClient', () => {
  const onNewMessages = jest.fn();
  const onAgentTyping = jest.fn();
  const onError = jest.fn();
  const onErrorResolved = jest.fn();
  const onNewSession = jest.fn();
  const onConnectionStatusChange = jest.fn();
  const onBurn = jest.fn();
  const onRegistration = jest.fn();
  const host = 'https://test.goquiq.fake';
  const contactPoint = 'test';
  const API = (ApiCalls: Object);
  const mockStore = (storage: any);

  beforeEach(() => {
    API.fetchConversation.mockReturnValue(Promise.resolve(initialConvo));
    API.fetchWebsocketInfo.mockReturnValue(
      Promise.resolve({
        url: 'https://websocket.test',
        protocol: 'atmosphere',
      }),
    );
    mockStore.getQuiqChatContainerVisible.mockReturnValue(true);
    mockStore.getQuiqUserTakenMeaningfulAction.mockReturnValue(true);
    mockStore.getQuiqUserIsSubscribed.mockReturnValue(true);

    QuiqChatClient.initialize(host, contactPoint);
    QuiqChatClient.onNewMessages(onNewMessages);
    QuiqChatClient.onAgentTyping(onAgentTyping);
    QuiqChatClient.onError(onError);
    QuiqChatClient.onErrorResolved(onErrorResolved);
    QuiqChatClient.onConnectionStatusChange(onConnectionStatusChange);
    QuiqChatClient.onRegistration(onRegistration);
    QuiqChatClient.onNewSession(onNewSession);
    QuiqChatClient.onBurn(onBurn);

    QuiqChatClient.start();
  });

  describe('init', () => {
    it('initializes localStorage', () => {
      expect(storage.init).toHaveBeenCalled();
    });
  });

  describe('start', () => {
    it('sets initialized flag to "true"', () => {
      expect(QuiqChatClient.initialized).toBe(true);
    });

    it('calls login', () => {
      expect(API.login).toBeCalled();
    });

    it('calls onNewMessages with the initial messages', () => {
      expect(onNewMessages).toBeCalledWith(initialConvo.messages);
    });

    it('tries to disconnect the websocket before making a new connection', () => {
      expect(disconnectSocket).toBeCalled();
    });

    it('connects the websocket', () => {
      expect(connectSocket).toBeCalled();
    });

    it('calls onConnectionStatusChange', () => {
      expect(onConnectionStatusChange).not.toBeCalled();
    });
  });

  describe('start with "initialized" set to true', () => {
    beforeEach(() => {
      jest.clearAllMocks();

      QuiqChatClient.initialize(host, contactPoint);
      QuiqChatClient.onNewMessages(onNewMessages);
      QuiqChatClient.onAgentTyping(onAgentTyping);
      QuiqChatClient.onError(onError);
      QuiqChatClient.onErrorResolved(onErrorResolved);
      QuiqChatClient.onConnectionStatusChange(onConnectionStatusChange);
      QuiqChatClient.onRegistration(onRegistration);
      QuiqChatClient.onNewSession(onNewSession);
      QuiqChatClient.onBurn(onBurn);

      QuiqChatClient.initialized = true;

      QuiqChatClient.start();
    });

    it('does not call login', () => {
      expect(API.login).not.toBeCalled();
    });

    it('does not call onNewMessages', () => {
      expect(onNewMessages).not.toBeCalled();
    });

    it('does not try to disconnect the websocket before making a new connection', () => {
      expect(disconnectSocket).not.toBeCalled();
    });

    it('does not connect the websocket', () => {
      expect(connectSocket).not.toBeCalled();
    });

    it('does not call onConnectionStatusChange', () => {
      expect(onConnectionStatusChange).not.toBeCalled();
    });
  });

  describe('stop', () => {
    beforeEach(() => {
      if (!QuiqChatClient) {
        throw new Error('Client should be defined');
      }

      QuiqChatClient.stop();
    });

    it('disconnects the websocket', () => {
      expect(disconnectSocket).toBeCalled();
    });

    it('sets initialzed flag to false', () => {
      expect(QuiqChatClient.initialized).toBe(false);
    });

    it('sets connected flag to false', () => {
      expect(QuiqChatClient.connected).toBe(false);
    });
  });

  describe('getting new messages', () => {
    const newMessage = {
      authorType: 'Customer',
      type: 'Text',
      id: 'msg3',
      timestamp: 3,
      text: 'blorp',
    };

    beforeEach(() => {
      if (!QuiqChatClient) {
        throw new Error('Client should be defined');
      }

      QuiqChatClient._handleWebsocketMessage({
        messageType: 'ChatMessage',
        tenantId: 'test',
        data: newMessage,
      });
    });

    it('calls onNewMessages', () => {
      expect(onNewMessages).lastCalledWith(initialConvo.messages.concat(newMessage));
    });
  });

  describe('handling new session', () => {
    beforeEach(() => {
      API.fetchWebsocketInfo.mockReturnValue(
        Promise.resolve({
          url: 'https://websocket.test',
          protocol: 'quiq',
        }),
      );
    });

    describe('when no trackingId is defined, i.e., this is first session', () => {
      it('updates cached trackingId', () => {
        if (!QuiqChatClient) {
          throw new Error('Client should be defined');
        }

        QuiqChatClient._handleNewSession(testTrackingId);
        expect(QuiqChatClient.trackingId).toBe(testTrackingId);
      });

      it('does NOT fire new session callback', () => {
        if (!QuiqChatClient) {
          throw new Error('Client should be defined');
        }

        QuiqChatClient._handleNewSession(testTrackingId);
        expect(QuiqChatClient.callbacks.onNewSession).not.toHaveBeenCalled();
      });
    });

    describe('when trackingId has not changed, i.e. session was refreshed', () => {
      beforeEach(() => {
        if (!QuiqChatClient) {
          throw new Error('Client should be defined');
        }

        API.fetchWebsocketInfo.mockReturnValue(
          Promise.resolve({
            url: 'https://websocket.test',
            protocol: 'quiq',
          }),
        );

        QuiqChatClient.trackingId = testTrackingId;
      });

      it('updates cached trackingId', () => {
        if (!QuiqChatClient) {
          throw new Error('Client should be defined');
        }

        QuiqChatClient._handleNewSession(testTrackingId);
        expect(QuiqChatClient.trackingId).toBe(testTrackingId);
      });

      it('does NOT fire new session callback', () => {
        if (!QuiqChatClient) {
          throw new Error('Client should be defined');
        }

        QuiqChatClient._handleNewSession(testTrackingId);
        expect(QuiqChatClient.callbacks.onNewSession).not.toHaveBeenCalled();
      });
    });

    describe('when trackingId has changed, i.e. new conversation', () => {
      beforeEach(() => {
        jest.clearAllMocks();
        API.fetchWebsocketInfo.mockReturnValue(
          Promise.resolve({
            url: 'https://websocket.test',
            protocol: 'quiq',
          }),
        );
        mockStore.getQuiqChatContainerVisible.mockReturnValue(true);
        mockStore.getQuiqUserTakenMeaningfulAction.mockReturnValue(true);

        QuiqChatClient.initialize(host, contactPoint);
        QuiqChatClient.onNewMessages(onNewMessages);
        QuiqChatClient.onAgentTyping(onAgentTyping);
        QuiqChatClient.onError(onError);
        QuiqChatClient.onErrorResolved(onErrorResolved);
        QuiqChatClient.onConnectionStatusChange(onConnectionStatusChange);
        QuiqChatClient.onRegistration(onRegistration);
        QuiqChatClient.onNewSession(onNewSession);
        QuiqChatClient.onBurn(onBurn);

        if (!QuiqChatClient) {
          throw new Error('Client should be defined');
        }

        QuiqChatClient.trackingId = 'oldId';
      });

      it('updates cached trackingId on trackingid change', async () => {
        if (!QuiqChatClient) {
          throw new Error('Client should be defined');
        }

        await QuiqChatClient._handleNewSession(testTrackingId);
        expect(QuiqChatClient.trackingId).toBe(testTrackingId);
      });

      it('does fire new session callback', () => {
        if (!QuiqChatClient) {
          throw new Error('Client should be defined');
        }

        QuiqChatClient._handleNewSession(testTrackingId);
        expect(QuiqChatClient.callbacks.onNewSession).toHaveBeenCalled();
      });
    });
  });

  describe('getting new Register event', () => {
    const newEvent = {type: 'Register', id: 'reg1', timestamp: 3};

    it('updates userIsRegistered', () => {
      if (!QuiqChatClient) {
        throw new Error('Client should be defined');
      }

      expect(QuiqChatClient.isRegistered()).toBe(false);
      QuiqChatClient._handleWebsocketMessage({
        messageType: 'ChatMessage',
        tenantId: 'test',
        data: newEvent,
      });
      expect(QuiqChatClient.isRegistered()).toBe(true);
      expect(onRegistration).toBeCalled();
    });
  });

  describe('getting typing indicator change', () => {
    beforeEach(() => {
      if (!QuiqChatClient) {
        throw new Error('Client should be defined');
      }

      QuiqChatClient._handleWebsocketMessage({
        messageType: 'ChatMessage',
        tenantId: 'test',
        data: {
          type: 'AgentTyping',
          typing: true,
          authorType: 'User',
          authorProfilePicture: 'testUrl',
          authorDisplayName: 'Homer',
        },
      });
    });

    it('calls onAgentTyping', () => {
      expect(onAgentTyping).toBeCalledWith(true, {
        authorType: 'User',
        authorProfilePicture: 'testUrl',
        authorDisplayName: 'Homer',
      });
    });
  });

  describe('isAgentAssigned', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      mockStore.getQuiqChatContainerVisible.mockReturnValue(true);
      mockStore.getQuiqUserTakenMeaningfulAction.mockReturnValue(false);

      QuiqChatClient.initialize(host, contactPoint);
      QuiqChatClient.onNewMessages(onNewMessages);
      QuiqChatClient.onAgentTyping(onAgentTyping);
      QuiqChatClient.onError(onError);
      QuiqChatClient.onErrorResolved(onErrorResolved);
      QuiqChatClient.onConnectionStatusChange(onConnectionStatusChange);
      QuiqChatClient.onRegistration(onRegistration);
      QuiqChatClient.onNewSession(onNewSession);
      QuiqChatClient.onBurn(onBurn);

      QuiqChatClient.events = [];
      QuiqChatClient.messages = [];
    });

    it('No conversation and no queueDisposition', () => {
      expect(QuiqChatClient.isAgentAssigned()).toBe(false);
    });

    it('No conversation with a waiting queueDisposition', () => {
      // $FlowIssue
      QuiqChatClient._handleWebsocketMessage({
        messageType: 'QueueDisposition',
        data: 'waiting',
      });
      expect(QuiqChatClient.isAgentAssigned()).toBe(false);
    });

    it('No conversation with an assigned queueDisposition', () => {
      // $FlowIssue
      QuiqChatClient._handleWebsocketMessage({
        messageType: 'QueueDisposition',
        data: 'assigned',
      });
      expect(QuiqChatClient.isAgentAssigned()).toBe(true);
    });

    it('No queueDisposition but active convo', () => {
      QuiqChatClient.messages = [
        {
          authorType: 'User',
          text: 'message',
          id: '1',
          timestamp: 10,
          type: 'Text',
        },
      ];
      QuiqChatClient._processQueueDisposition('waiting');
      expect(QuiqChatClient.isAgentAssigned()).toBe(true);
    });

    it('No queueDisposition and inactive convo', () => {
      QuiqChatClient.messages = [
        {
          authorType: 'User',
          text: 'message',
          id: '1',
          timestamp: 10,
          type: 'Text',
        },
      ];
      QuiqChatClient.events = [
        {
          id: '2',
          timestamp: 11,
          type: 'End',
        },
      ];
      QuiqChatClient._processQueueDisposition('waiting');
      expect(QuiqChatClient.isAgentAssigned()).toBe(false);
    });

    it('No queueDisposition and active convo with history', () => {
      QuiqChatClient.messages = [
        {
          authorType: 'User',
          text: 'message',
          id: '1',
          timestamp: 10,
          type: 'Text',
        },
        {
          authorType: 'User',
          text: 'message',
          id: '3',
          timestamp: 12,
          type: 'Text',
        },
      ];
      QuiqChatClient.events = [
        {
          id: '2',
          timestamp: 11,
          type: 'End',
        },
      ];
      QuiqChatClient._processQueueDisposition('waiting');
      expect(QuiqChatClient.isAgentAssigned()).toBe(true);
    });
  });

  describe('API wrappers', () => {
    afterEach(() => {
      set.mockClear();
    });

    describe('isChatVisible', () => {
      it('returns the value of the quiq-chat-container-visible value value', () => {
        if (!QuiqChatClient) {
          throw new Error('Client undefined');
        }

        mockStore.getQuiqChatContainerVisible.mockReturnValueOnce(false);
        expect(QuiqChatClient.isChatVisible()).toBe(false);
      });
    });

    describe('hasTakenMeaningfulAction', () => {
      beforeEach(() => {
        if (!QuiqChatClient) {
          throw new Error('Client should be defined');
        }
      });

      it('returns the value of the quiq-user-taken-meaningful-action value value', () => {
        if (!QuiqChatClient) {
          throw new Error('Client undefined');
        }

        mockStore.getQuiqUserTakenMeaningfulAction.mockReturnValueOnce(false);
        expect(QuiqChatClient.hasTakenMeaningfulAction()).toBe(false);
      });
    });

    describe('sendTextMessage', () => {
      beforeEach(() => {
        jest.clearAllMocks();
        API.fetchWebsocketInfo.mockReturnValue({
          url: 'https://websocket.test',
          protocol: 'atmosphere',
        });
        mockStore.getQuiqChatContainerVisible.mockReturnValue(true);
        mockStore.getQuiqUserTakenMeaningfulAction.mockReturnValue(true);

        QuiqChatClient.initialize(host, contactPoint);
        QuiqChatClient.onNewMessages(onNewMessages);
        QuiqChatClient.onAgentTyping(onAgentTyping);
        QuiqChatClient.onError(onError);
        QuiqChatClient.onErrorResolved(onErrorResolved);
        QuiqChatClient.onConnectionStatusChange(onConnectionStatusChange);
        QuiqChatClient.onRegistration(onRegistration);
        QuiqChatClient.onNewSession(onNewSession);
        QuiqChatClient.onBurn(onBurn);

        if (!QuiqChatClient) {
          throw new Error('Client undefined');
        }

        QuiqChatClient.connected = true;
        QuiqChatClient.sendTextMessage('text');
      });

      it('proxies call on send messagewqw', () => {
        expect(API.sendTextMessage).toBeCalledWith('text');
      });

      it('calls storage.setQuiqChatContainerVisible', () => {
        expect(mockStore.setQuiqChatContainerVisible).toBeCalledWith(true);
      });

      it('calls storage.setQuiqUserTakenMeaningfulAction', () => {
        expect(mockStore.setQuiqUserIsSubscribed).toBeCalledWith(true);
      });
    });

    describe('updateTypingIndicator', () => {
      it('proxies call', () => {
        if (!QuiqChatClient) {
          throw new Error('Client undefined');
        }

        QuiqChatClient.updateTypingIndicator('text', true);
        expect(API.updateTypingIndicator).toBeCalledWith('text', true);
      });
    });

    describe('sendRegistration', () => {
      const data = {firstName: 'SpongeBob', lastName: 'SquarePants'};
      const versionId = 'bleh';

      beforeEach(() => {
        if (!QuiqChatClient) {
          throw new Error('Client undefined');
        }

        QuiqChatClient.sendRegistration(data, versionId);
      });

      it('proxies call', () => {
        expect(API.sendRegistration).toHaveBeenCalledWith(data, versionId);
      });

      it('calls storage.setQuiqChatContainerVisible', () => {
        expect(mockStore.setQuiqChatContainerVisible).toHaveBeenCalled();
      });
    });
  });

  describe('websocket message handling', () => {
    describe('BurnItDown message', () => {
      it('calls burnItDown', () => {
        const message = {
          messageType: 'BurnItDown',
          data: {before: 0, code: 466, force: true},
          tenantId: 'test',
        };
        QuiqChatClient._handleWebsocketMessage(message);
        expect(Utils.burnItDown).toBeCalledWith(message.data);
      });
    });

    describe('ChatMessage', () => {
      describe('REGISTER', () => {
        beforeEach(() => {
          const message = {
            messageType: 'ChatMessage',
            tenantId: 'me!',
            data: {
              id: 'test',
              timestamp: 123,
              type: 'Register',
            },
          };
          QuiqChatClient._handleWebsocketMessage(message);
        });

        it('sets meaningful action flag in local storage', () => {
          expect(storage.setQuiqUserIsSubscribed).toHaveBeenCalledWith(true);
        });
      });
    });
  });

  // TODO: Fix these tests to work with QuiqSocket. They're currently broken, and are running against atmosphere.
  /* These tests need to be at the end of the run, otherwise they seem to goof
    up other tests */
  // eslint-disable-next-line no-restricted-syntax
  xdescribe('start with an error', () => {
    beforeEach(() => {
      global.console.error = jest.fn();

      API.fetchWebsocketInfo.mockReturnValueOnce(Promise.reject({status: 405}));

      QuiqChatClient.initialize(host, contactPoint);
      QuiqChatClient.onNewMessages(onNewMessages);
      QuiqChatClient.onAgentTyping(onAgentTyping);
      QuiqChatClient.onError(onError);
      QuiqChatClient.onErrorResolved(onErrorResolved);
      QuiqChatClient.onConnectionStatusChange(onConnectionStatusChange);
      QuiqChatClient.onBurn(onBurn);

      QuiqChatClient.start();
    });

    it('calls disconnectSocket', () => {
      expect(disconnectSocket).toBeCalled();
      expect(onError).not.toBeCalledWith({status: 405});
    });
  });

  // eslint-disable-next-line no-restricted-syntax
  xdescribe('start with non-retryable error', () => {
    beforeEach(() => {
      // Return a retryable error once
      API.fetchWebsocketInfo.mockReturnValueOnce(Promise.reject({status: 404}));

      QuiqChatClient.initialize(host, contactPoint);
      QuiqChatClient.onNewMessages(onNewMessages);
      QuiqChatClient.onAgentTyping(onAgentTyping);
      QuiqChatClient.onError(onError);
      QuiqChatClient.onErrorResolved(onErrorResolved);
      QuiqChatClient.onConnectionStatusChange(onConnectionStatusChange);
      QuiqChatClient.onBurn(onBurn);
      QuiqChatClient.start();
    });

    it('calls disconnectSocket', () => {
      expect(disconnectSocket).toBeCalled();
    });

    it('calls onError', () => {
      expect(onError).toBeCalledWith({status: 404});
    });
  });
});

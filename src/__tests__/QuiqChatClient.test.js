// @flow
jest.mock('../apiCalls');
jest.mock('../websockets');
jest.mock('../storage');
jest.mock('store');

import QuiqChatClient from '../QuiqChatClient';
import * as ApiCalls from '../apiCalls';
import * as storage from '../storage';
import {connectSocket, disconnectSocket} from '../websockets';
import {set} from 'store';
import {MINUTES_UNTIL_INACTIVE} from '../appConstants';
import * as stubbornFetch from '../stubbornFetch';

const initialConvo = {
  id: 'testConvo',
  messages: [
    {
      authorType: 'Customer',
      text: 'Marco',
      id: 'msg1',
      timestamp: 1,
      type: 'Text',
    },
    {
      authorType: 'Agent',
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
  const onClientInactiveTimeout = jest.fn();
  const host = 'https://test.goquiq.fake';
  const contactPoint = 'test';
  const API = (ApiCalls: Object);
  let client: QuiqChatClient;
  const mockStore = (storage: any);
  const setClientInactive = jest.spyOn(stubbornFetch, 'setClientInactive');

  beforeEach(() => {
    API.fetchConversation.mockReturnValue(Promise.resolve(initialConvo));
    API.fetchWebsocketInfo.mockReturnValue({url: 'https://websocket.test'});
    mockStore.getQuiqChatContainerVisible.mockReturnValue(true);
    mockStore.getQuiqUserTakenMeaningfulAction.mockReturnValue(true);

    client = new QuiqChatClient(host, contactPoint)
      .onNewMessages(onNewMessages)
      .onAgentTyping(onAgentTyping)
      .onError(onError)
      .onErrorResolved(onErrorResolved)
      .onConnectionStatusChange(onConnectionStatusChange)
      .onRegistration(onRegistration)
      .onNewSession(onNewSession)
      .onBurn(onBurn)
      .onClientInactiveTimeout(onClientInactiveTimeout);

    client.start();
  });

  describe('start', () => {
    it('sets initialized flag to "true"', () => {
      expect(client.initialized).toBe(true);
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
      expect(onConnectionStatusChange).toBeCalledWith(true);
    });

    it('calls setClientInactive with false', () => {
      expect(setClientInactive).toBeCalledWith(false);
    });
  });

  describe('start with "initialized" set to true', () => {
    beforeEach(() => {
      jest.clearAllMocks();

      client = new QuiqChatClient(host, contactPoint)
        .onNewMessages(onNewMessages)
        .onAgentTyping(onAgentTyping)
        .onError(onError)
        .onErrorResolved(onErrorResolved)
        .onConnectionStatusChange(onConnectionStatusChange)
        .onRegistration(onRegistration)
        .onNewSession(onNewSession)
        .onBurn(onBurn);

      client.initialized = true;

      client.start();
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

    it('does not call setClientInactive', () => {
      expect(setClientInactive).not.toBeCalled();
    });
  });

  describe('start with an error', () => {
    beforeEach(() => {
      global.console.error = jest.fn();

      API.fetchWebsocketInfo.mockReturnValueOnce(Promise.reject({status: 405}));

      client = new QuiqChatClient(host, contactPoint)
        .onNewMessages(onNewMessages)
        .onAgentTyping(onAgentTyping)
        .onError(onError)
        .onErrorResolved(onErrorResolved)
        .onConnectionStatusChange(onConnectionStatusChange)
        .onBurn(onBurn);

      client.start();
    });

    it('calls disconnectSocket', () => {
      expect(disconnectSocket).toBeCalled();
      expect(onError).toBeCalledWith({status: 405});
    });
  });

  describe('start with non-retryable error', () => {
    beforeEach(() => {
      // Return a retryable error once
      API.fetchWebsocketInfo.mockReturnValueOnce(Promise.reject({status: 404}));

      new QuiqChatClient(host, contactPoint)
        .onNewMessages(onNewMessages)
        .onAgentTyping(onAgentTyping)
        .onError(onError)
        .onErrorResolved(onErrorResolved)
        .onConnectionStatusChange(onConnectionStatusChange)
        .onBurn(onBurn)
        .start();
    });

    it('calls disconnectSocket', () => {
      expect(disconnectSocket).toBeCalled();
    });

    it('calls onError', () => {
      expect(onError).toBeCalledWith({status: 404});
    });
  });

  describe('stop', () => {
    beforeEach(() => {
      if (!client) {
        throw new Error('Client should be defined');
      }

      client.stop();
    });

    it('disconnects the websocket', () => {
      expect(disconnectSocket).toBeCalled();
    });

    it('sets initialzed flag to false', () => {
      expect(client.initialized).toBe(false);
    });

    it('sets connected flag to false', () => {
      expect(client.connected).toBe(false);
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
      if (!client) {
        throw new Error('Client should be defined');
      }

      client._handleWebsocketMessage({
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
    describe('when no trackingId is defined, i.e., this is first session', () => {
      it('updates cached trackingId', () => {
        if (!client) {
          throw new Error('Client should be defined');
        }

        client._handleNewSession(testTrackingId);
        expect(client.trackingId).toBe(testTrackingId);
      });

      it('does NOT fire new session callback', () => {
        if (!client) {
          throw new Error('Client should be defined');
        }

        client._handleNewSession(testTrackingId);
        expect(client.callbacks.onNewSession).not.toHaveBeenCalled();
      });
    });

    describe('when trackingId has not changed, i.e. session was refreshed', () => {
      beforeEach(() => {
        if (!client) {
          throw new Error('Client should be defined');
        }

        client.trackingId = testTrackingId;
      });

      it('updates cached trackingId', () => {
        if (!client) {
          throw new Error('Client should be defined');
        }

        client._handleNewSession(testTrackingId);
        expect(client.trackingId).toBe(testTrackingId);
      });

      it('does NOT fire new session callback', () => {
        if (!client) {
          throw new Error('Client should be defined');
        }

        client._handleNewSession(testTrackingId);
        expect(client.callbacks.onNewSession).not.toHaveBeenCalled();
      });
    });

    describe('when trackingId has changed, i.e. new conversation', () => {
      beforeEach(() => {
        if (!client) {
          throw new Error('Client should be defined');
        }

        client.trackingId = 'oldId';
      });

      it('updates cached trackingId', async () => {
        if (!client) {
          throw new Error('Client should be defined');
        }

        await client._handleNewSession(testTrackingId);
        expect(client.trackingId).toBe(testTrackingId);
      });

      it('does fire new session callback', () => {
        if (!client) {
          throw new Error('Client should be defined');
        }

        client._handleNewSession(testTrackingId);
        expect(client.callbacks.onNewSession).toHaveBeenCalled();
      });
    });
  });

  describe('getting new Register event', () => {
    const newEvent = {type: 'Register', id: 'reg1', timestamp: 3};

    it('updates userIsRegistered', () => {
      if (!client) {
        throw new Error('Client should be defined');
      }

      expect(client.isRegistered()).toBe(false);
      client._handleWebsocketMessage({
        messageType: 'ChatMessage',
        tenantId: 'test',
        data: newEvent,
      });
      expect(client.isRegistered()).toBe(true);
      expect(onRegistration).toBeCalled();
    });
  });

  describe('getting typing indicator change', () => {
    beforeEach(() => {
      if (!client) {
        throw new Error('Client should be defined');
      }

      client._handleWebsocketMessage({
        messageType: 'ChatMessage',
        tenantId: 'test',
        data: {type: 'AgentTyping', typing: true},
      });
    });

    it('calls onAgentTyping', () => {
      expect(onAgentTyping).toBeCalledWith(true);
    });
  });

  describe('client gets burned', () => {
    beforeEach(() => {
      if (!client) {
        throw new Error('Client should be defined');
      }

      client._handleWebsocketMessage({
        messageType: 'ChatMessage',
        tenantId: 'test',
        data: {type: 'BurnItDown'},
      });
    });

    it('calls onBurn', () => {
      expect(onBurn).toBeCalled();
    });
  });

  describe('client inactivity timeout', () => {
    beforeEach(() => {
      if (!client) {
        throw new Error('Client should be defined');
      }
    });

    afterEach(() => {
      clearTimeout(client.clientInactiveTimer);
    });

    it('initializes with a timer set', () => {
      expect(client.clientInactiveTimer).toBeDefined();
    });

    it('sets a timer when registration sent', () => {
      client.sendRegistration({firstName: 'SpongeBob', lastName: 'SquarePants'});
      expect(client.clientInactiveTimer).toBeDefined();
    });

    it('sets a timer when message sent', () => {
      client.sendMessage('ahoy');
      expect(client.clientInactiveTimer).toBeDefined();
    });

    describe('timeout logic when timer expires', () => {
      beforeEach(() => {
        jest.useFakeTimers();
        jest.clearAllMocks();
        client.stop = jest.fn();
        client.leaveChat = jest.fn();
        client._setTimeUntilInactive(MINUTES_UNTIL_INACTIVE);
      });

      it('times out after appConstants.MINUTES_UNTIL_INACTIVE minutes', () => {
        expect(setTimeout.mock.calls.length).toBe(1);
        expect(setTimeout.mock.calls[0][1]).toBe(MINUTES_UNTIL_INACTIVE * 60 * 1000 + 1000);
      });

      it('calls onClientInactiveTimeout callback', () => {
        expect(onClientInactiveTimeout).not.toBeCalled();
        jest.runAllTimers();
        expect(onClientInactiveTimeout).toBeCalled();
      });

      it('calls stop', () => {
        expect(client.stop).not.toBeCalled();
        jest.runAllTimers();
        expect(client.stop).toBeCalled();
      });

      it('calls leaveChat', () => {
        expect(client.leaveChat).not.toBeCalled();
        jest.runAllTimers();
        expect(client.leaveChat).toBeCalled();
      });

      it('calls setClientInactive with true', () => {
        expect(setClientInactive).not.toBeCalled();
        jest.runAllTimers();
        expect(setClientInactive).toBeCalledWith(true);
      });
    });
  });

  describe('API wrappers', () => {
    afterEach(() => {
      set.mockClear();
    });

    describe('joinChat', () => {
      beforeEach(() => {
        if (!client) {
          throw new Error('Client undefined');
        }

        client.joinChat();
      });

      it('proxies call', () => {
        expect(API.joinChat).toBeCalled();
      });

      it('sets the quiq-chat-container-visible value to true', () => {
        expect(mockStore.setQuiqChatContainerVisible).toBeCalledWith(true);
      });
    });

    describe('isStorageEnabled', () => {
      it('returns the value of the quiq-chat-container-visible', () => {
        if (!client) {
          throw new Error('Client undefined');
        }

        mockStore.isStorageEnabled.mockReturnValueOnce(false);
        expect(client.isStorageEnabled()).toBe(false);
      });
    });

    describe('isChatVisible', () => {
      it('returns the value of the quiq-chat-container-visible value value', () => {
        if (!client) {
          throw new Error('Client undefined');
        }

        mockStore.getQuiqChatContainerVisible.mockReturnValueOnce(false);
        expect(client.isChatVisible()).toBe(false);
      });
    });

    describe('hasTakenMeaningfulAction', () => {
      beforeEach(() => {
        if (!client) {
          throw new Error('Client should be defined');
        }
      });

      it('returns the value of the quiq-user-taken-meaningful-action value value', () => {
        if (!client) {
          throw new Error('Client undefined');
        }

        mockStore.getQuiqUserTakenMeaningfulAction.mockReturnValueOnce(false);
        expect(client.hasTakenMeaningfulAction()).toBe(false);
      });
    });

    describe('leaveChat', () => {
      beforeEach(() => {
        if (!client) {
          throw new Error('Client undefined');
        }

        client.leaveChat();
      });

      it('proxies call', () => {
        expect(API.leaveChat).toBeCalled();
      });

      it('sets the quiq-chat-container-visible value to false', () => {
        expect(mockStore.setQuiqChatContainerVisible).toBeCalledWith(false);
      });
    });

    describe('sendMessage', () => {
      beforeEach(() => {
        if (!client) {
          throw new Error('Client undefined');
        }

        client.sendMessage('text');
      });

      it('proxies call', () => {
        expect(API.addMessage).toBeCalledWith('text');
      });

      it('calls storage.setQuiqChatContainerVisible', () => {
        expect(mockStore.setQuiqChatContainerVisible).toBeCalledWith(true);
      });

      it('calls storage.setQuiqUserTakenMeaningfulAction', () => {
        expect(mockStore.setQuiqUserTakenMeaningfulAction).toBeCalledWith(true);
      });

      it('calls storage.setClientInactiveTime', () => {
        expect(mockStore.setClientInactiveTime).toBeCalledWith(MINUTES_UNTIL_INACTIVE);
      });
    });

    describe('updateMessagePreview', () => {
      it('proxies call', () => {
        if (!client) {
          throw new Error('Client undefined');
        }

        client.updateMessagePreview('text', true);
        expect(API.updateMessagePreview).toBeCalledWith('text', true);
      });
    });

    describe('sendRegistration', () => {
      const data = {firstName: 'SpongeBob', lastName: 'SquarePants'};

      beforeEach(() => {
        if (!client) {
          throw new Error('Client undefined');
        }

        client.sendRegistration(data);
      });

      it('proxies call', () => {
        expect(API.sendRegistration).toBeCalledWith(data);
      });

      it('calls storage.setQuiqChatContainerVisible', () => {
        expect(mockStore.setQuiqChatContainerVisible).toBeCalledWith(true);
      });

      it('calls storage.setQuiqUserTakenMeaningfulAction', () => {
        expect(mockStore.setQuiqUserTakenMeaningfulAction).toBeCalledWith(true);
      });

      it('calls storage.setClientInactiveTime', () => {
        expect(mockStore.setClientInactiveTime).toBeCalledWith(MINUTES_UNTIL_INACTIVE);
      });
    });
  });
});

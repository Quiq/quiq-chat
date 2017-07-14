// @flow
jest.mock('../apiCalls');
jest.mock('../websockets');
jest.mock('../cookies');
jest.mock('js-cookie');

import QuiqChatClient from '../QuiqChatClient';
import * as ApiCalls from '../apiCalls';
import * as cookies from '../cookies';
import {connectSocket, disconnectSocket} from '../websockets';
import {set} from 'js-cookie';

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

describe('QuiqChatClient', () => {
  const onNewMessages = jest.fn();
  const onAgentTyping = jest.fn();
  const onError = jest.fn();
  const onErrorResolved = jest.fn();
  const onConnectionStatusChange = jest.fn();
  const onBurn = jest.fn();
  const host = 'https://test.goquiq.fake';
  const contactPoint = 'test';
  const API = (ApiCalls: Object);
  let client: ?QuiqChatClient;
  const mockCookies = (cookies: any);

  beforeEach(() => {
    API.fetchConversation.mockReturnValue(Promise.resolve(initialConvo));
    API.fetchWebsocketInfo.mockReturnValue({url: 'https://websocket.test'});
    mockCookies.getQuiqChatContainerVisibleCookie.mockReturnValue(true);
    mockCookies.getQuiqLauncherVisibleCookie.mockReturnValue(true);

    client = new QuiqChatClient(host, contactPoint)
      .onNewMessages(onNewMessages)
      .onAgentTyping(onAgentTyping)
      .onError(onError)
      .onErrorResolved(onErrorResolved)
      .onConnectionStatusChange(onConnectionStatusChange)
      .onBurn(onBurn);

    client.start();
  });

  describe('start', () => {
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
      expect(onNewMessages).toBeCalledWith([newMessage]);
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

      it('sets the quiq-chat-container-visible cookie to true', () => {
        expect(mockCookies.setQuiqChatContainerVisibleCookie).toBeCalledWith(true);
      });
    });

    describe('isChatVisible', () => {
      it('returns the value of the quiq-chat-container-visible cookie value', () => {
        if (!client) {
          throw new Error('Client undefined');
        }

        mockCookies.getQuiqChatContainerVisibleCookie.mockReturnValueOnce(false);
        expect(client.isChatVisible()).toBe(false);
      });
    });

    describe('hasActiveChat', () => {
      beforeEach(() => {
        if (!client) {
          throw new Error('Client should be defined');
        }
      });

      describe('when launcher is not visible', () => {
        it('returns false', async () => {
          if (!client) {
            throw new Error('Client undefined');
          }

          mockCookies.getQuiqLauncherVisibleCookie.mockReturnValue(false);
          const res = await client.hasActiveChat();
          expect(res).toBe(false);
        });
      });

      describe('when there are no messages', () => {
        it('returns false', async () => {
          if (!client) {
            throw new Error('Client undefined');
          }

          mockCookies.getQuiqLauncherVisibleCookie.mockReturnValue(false);
          API.fetchConversation.mockReturnValue([]);
          const res = await client.hasActiveChat();
          expect(res).toBe(false);
        });
      });

      describe('when there are messages', () => {
        it('returns true', async () => {
          if (!client) {
            throw new Error('Client undefined');
          }

          mockCookies.getQuiqLauncherVisibleCookie.mockReturnValue(true);
          API.fetchConversation.mockReturnValue(initialConvo);
          const res = await client.hasActiveChat();
          expect(res).toBe(true);
        });
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

      it('sets the quiq-chat-container-visible cookie to false', () => {
        expect(mockCookies.setQuiqChatContainerVisibleCookie).toBeCalledWith(false);
      });
    });

    describe('sendMessage', () => {
      it('proxies call', () => {
        if (!client) {
          throw new Error('Client undefined');
        }

        client.sendMessage('text');
        expect(API.addMessage).toBeCalledWith('text');
        expect(mockCookies.setQuiqChatContainerVisibleCookie).toBeCalledWith(true);
        expect(mockCookies.setQuiqLauncherVisibleCookie).toBeCalledWith(true);
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
      it('proxies call', () => {
        if (!client) {
          throw new Error('Client undefined');
        }
        const data = {firstName: 'SpongeBob', lastName: 'SquarePants'};

        client.sendRegistration(data);
        expect(API.sendRegistration).toBeCalledWith(data);
        expect(mockCookies.setQuiqChatContainerVisibleCookie).toBeCalledWith(true);
        expect(mockCookies.setQuiqLauncherVisibleCookie).toBeCalledWith(true);
      });
    });
  });
});

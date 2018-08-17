jest.mock('../apiCalls');
jest.mock('../storage');
jest.mock('store');
jest.mock('../Utils/utils');
jest.mock('../logging');
jest.mock('../services/QuiqSocketSingleton');

import {
  AuthorType,
  BurnItDownMessage,
  ChatMessage,
  ChatterboxMessageType,
  ConversationMessageType,
  EventType,
  QueueDisposition,
  QueueDispositionMessage,
  RegisterEvent,
  TextMessage,
} from '../types';

import QuiqChatClient from '../quiq-chat';
import * as ApiCalls from '../apiCalls';
import { set } from 'store';
import * as Utils from '../Utils/utils';
import * as log from 'loglevel';
import QuiqSocketSingleton from '../services/QuiqSocketSingleton';
import ChatState, {reset as ResetState} from '../State';

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
  const onTranscriptChange = jest.fn();
  const onAgentTyping = jest.fn();
  const onError = jest.fn();
  const onErrorResolution = jest.fn();
  const onNewSession = jest.fn();
  const onReconnect = jest.fn();
  const onBurn = jest.fn();
  const onRegistration = jest.fn();
  const host = 'https://test.goquiq.fake';
  const contactPoint = 'test';
  const API = <any>ApiCalls;

  beforeEach(() => {
    ResetState();
    API.fetchConversation.mockReturnValue(Promise.resolve(initialConvo));
    API.fetchWebsocketInfo.mockReturnValue(
      Promise.resolve({
        url: 'https://websocket.test',
        protocol: 'atmosphere',
      }),
    );

    ChatState.chatIsVisible = true;
    ChatState.hasTakenMeaningfulAction = true;
    ChatState.subscribed = true;

    QuiqChatClient.initialize(host, contactPoint);
    QuiqChatClient.onTranscriptChange(onTranscriptChange);
    QuiqChatClient.onAgentTyping(onAgentTyping);
    QuiqChatClient.onError(onError);
    QuiqChatClient.onErrorResolution(onErrorResolution);
    QuiqChatClient.onReconnect(onReconnect);
    QuiqChatClient.onRegistration(onRegistration);
    QuiqChatClient.onNewSession(onNewSession);
    QuiqChatClient.onBurn(onBurn);

    QuiqChatClient.start();
  });

  describe('init', () => {
    it('sets host and contactPoint in chat state', () => {
      expect(ChatState.host).toBe(host);
      expect(ChatState.contactPoint).toBe(contactPoint);
    });
  });

  describe('start', () => {
    it('sets initialized flag to "true"', () => {
      expect(QuiqChatClient.initialized).toBe(true);
    });

    it('calls login', () => {
      expect(API.login).toBeCalled();
    });

    it('calls onTranscriptChange with the initial transcript', () => {
      expect(onTranscriptChange).toBeCalledWith(initialConvo.messages);
    });

    it('tries to disconnect the websocket before making a new connection', () => {
      expect(QuiqSocketSingleton.disconnect).toBeCalled();
    });

    it('does NOT connect the websocket', () => {
      expect(QuiqSocketSingleton.connect).not.toBeCalled();
    });
  });

  describe('start with "initialized" set to true', () => {
    beforeEach(() => {
      jest.clearAllMocks();

      QuiqChatClient.initialize(host, contactPoint);
      QuiqChatClient.onTranscriptChange(onTranscriptChange);
      QuiqChatClient.onAgentTyping(onAgentTyping);
      QuiqChatClient.onError(onError);
      QuiqChatClient.onErrorResolution(onErrorResolution);
      QuiqChatClient.onReconnect(onReconnect);
      QuiqChatClient.onRegistration(onRegistration);
      QuiqChatClient.onNewSession(onNewSession);
      QuiqChatClient.onBurn(onBurn);

      QuiqChatClient.initialized = true;

      QuiqChatClient.start();
    });

    it('does not call login', () => {
      expect(API.login).not.toBeCalled();
    });

    it('does not call onTranscriptChange', () => {
      expect(onTranscriptChange).not.toBeCalled();
    });

    it('does not try to disconnect the websocket before making a new connection', () => {
      expect(QuiqSocketSingleton.disconnect).not.toBeCalled();
    });

    it('does not connect the websocket', () => {
      expect(QuiqSocketSingleton.connect).not.toBeCalled();
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
      expect(QuiqSocketSingleton.disconnect).toBeCalled();
    });

    it('sets initialzed flag to false', () => {
      expect(QuiqChatClient.initialized).toBe(false);
    });

    it('sets connected flag to false', () => {
      expect(ChatState.connected).toBe(false);
    });
  });

  describe('getting new messages', () => {
    const newMessage: TextMessage = {
      authorType: AuthorType.CUSTOMER,
      type: ConversationMessageType.TEXT,
      id: 'msg3',
      timestamp: 3,
      text: 'blorp',
    };

    beforeEach(() => {
      if (!QuiqChatClient) {
        throw new Error('Client should be defined');
      }

      // @ts-ignore private access
      QuiqChatClient._handleWebsocketMessage({
        messageType: ChatterboxMessageType.CHAT_MESSAGE,
        tenantId: 'test',
        data: newMessage,
      });
    });

    it('calls onTranscriptChange', () => {
      expect(onTranscriptChange).lastCalledWith(initialConvo.messages.concat(newMessage));
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

        // @ts-ignore private access
        QuiqChatClient._handleNewSession(testTrackingId);
        expect(ChatState.trackingId).toBe(testTrackingId);
      });

      it('does NOT fire new session callback', () => {
        if (!QuiqChatClient) {
          throw new Error('Client should be defined');
        }

        // @ts-ignore private access
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

        ChatState.trackingId = testTrackingId;
      });

      it('updates cached trackingId', () => {
        if (!QuiqChatClient) {
          throw new Error('Client should be defined');
        }

        // @ts-ignore private access
        QuiqChatClient._handleNewSession(testTrackingId);
        expect(ChatState.trackingId).toBe(testTrackingId);
      });

      it('does NOT fire new session callback', () => {
        if (!QuiqChatClient) {
          throw new Error('Client should be defined');
        }

        // @ts-ignore private access
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

        ChatState.chatIsVisible = true;
        ChatState.hasTakenMeaningfulAction = true;

        QuiqChatClient.initialize(host, contactPoint);
        QuiqChatClient.onTranscriptChange(onTranscriptChange);
        QuiqChatClient.onAgentTyping(onAgentTyping);
        QuiqChatClient.onError(onError);
        QuiqChatClient.onErrorResolution(onErrorResolution);
        QuiqChatClient.onReconnect(onReconnect);
        QuiqChatClient.onRegistration(onRegistration);
        QuiqChatClient.onNewSession(onNewSession);
        QuiqChatClient.onBurn(onBurn);

        if (!QuiqChatClient) {
          throw new Error('Client should be defined');
        }

        ChatState.trackingId = 'oldId';
      });

      it('updates cached trackingId on trackingid change', async () => {
        if (!QuiqChatClient) {
          throw new Error('Client should be defined');
        }

        // @ts-ignore private access
        await QuiqChatClient._handleNewSession(testTrackingId);
        expect(ChatState.trackingId).toBe(testTrackingId);
      });

      it('does fire new session callback', () => {
        if (!QuiqChatClient) {
          throw new Error('Client should be defined');
        }

        // @ts-ignore private access
        QuiqChatClient._handleNewSession(testTrackingId);
        expect(QuiqChatClient.callbacks.onNewSession).toHaveBeenCalled();
      });
    });
  });

  describe('getting new Register event', () => {
    const newEvent: RegisterEvent = { type: EventType.REGISTER, id: 'reg1', timestamp: 3 };

    it('updates userIsRegistered', () => {
      if (!QuiqChatClient) {
        throw new Error('Client should be defined');
      }

      expect(QuiqChatClient.isRegistered()).toBe(false);
      // @ts-ignore private access
      QuiqChatClient._handleWebsocketMessage({
        messageType: ChatterboxMessageType.CHAT_MESSAGE,
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

      // @ts-ignore private access
      QuiqChatClient._handleWebsocketMessage({
        messageType: ChatterboxMessageType.CHAT_MESSAGE,
        tenantId: 'test',
        data: {
          type: ConversationMessageType.AGENT_TYPING,
          typing: true,
          authorType: AuthorType.USER,
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

      ChatState.chatIsVisible = true;
      ChatState.hasTakenMeaningfulAction = false;

      QuiqChatClient.initialize(host, contactPoint);
      QuiqChatClient.onTranscriptChange(onTranscriptChange);
      QuiqChatClient.onAgentTyping(onAgentTyping);
      QuiqChatClient.onError(onError);
      QuiqChatClient.onErrorResolution(onErrorResolution);
      QuiqChatClient.onReconnect(onReconnect);
      QuiqChatClient.onRegistration(onRegistration);
      QuiqChatClient.onNewSession(onNewSession);
      QuiqChatClient.onBurn(onBurn);

      QuiqChatClient.transcript = [];
    });

    it('No conversation and no queueDisposition', () => {
      expect(QuiqChatClient.isAgentAssigned()).toBe(false);
    });

    it('No conversation with a waiting queueDisposition', () => {
      // @ts-ignore private access
      QuiqChatClient._handleWebsocketMessage(<QueueDispositionMessage>{
        messageType: ChatterboxMessageType.QUEUE_DISPOSITION,
        data: QueueDisposition.WAITING,
      });
      expect(QuiqChatClient.isAgentAssigned()).toBe(false);
    });

    it('No conversation with an assigned queueDisposition', () => {
      // @ts-ignore private access
      QuiqChatClient._handleWebsocketMessage(<QueueDispositionMessage>{
        messageType: ChatterboxMessageType.QUEUE_DISPOSITION,
        data: QueueDisposition.ASSIGNED,
      });
      expect(QuiqChatClient.isAgentAssigned()).toBe(true);
    });

    it('No queueDisposition but active convo', () => {
      QuiqChatClient.transcript = [
        {
          authorType: AuthorType.USER,
          text: 'message',
          id: '1',
          timestamp: 10,
          type: ConversationMessageType.TEXT,
        },
      ];

      // @ts-ignore private access
      QuiqChatClient._processQueueDisposition(QueueDisposition.WAITING);
      expect(QuiqChatClient.isAgentAssigned()).toBe(true);
    });

    it('No queueDisposition and inactive convo', () => {
      QuiqChatClient.transcript = [
        {
          authorType: AuthorType.USER,
          text: 'message',
          id: '1',
          timestamp: 10,
          type: ConversationMessageType.TEXT,
        },
        {
          id: '2',
          timestamp: 11,
          type: EventType.END,
        },
      ];

      // @ts-ignore private access
      QuiqChatClient._processQueueDisposition(QueueDisposition.WAITING);
      expect(QuiqChatClient.isAgentAssigned()).toBe(false);
    });

    it('No queueDisposition and active convo with history', () => {
      QuiqChatClient.transcript = [
        {
          authorType: AuthorType.USER,
          text: 'message',
          id: '1',
          timestamp: 10,
          type: ConversationMessageType.TEXT,
        },
        {
          authorType: AuthorType.USER,
          text: 'message',
          id: '3',
          timestamp: 12,
          type: ConversationMessageType.TEXT,
        },
        {
          id: '2',
          timestamp: 11,
          type: EventType.END,
        },
      ];

      // @ts-ignore private access
      QuiqChatClient._processQueueDisposition(QueueDisposition.WAITING);
      expect(QuiqChatClient.isAgentAssigned()).toBe(true);
    });
  });

  describe('API wrappers', () => {
    afterEach(() => {
      (<any>set).mockClear();
    });

    describe('isChatVisible', () => {
      it('returns the value of the quiq-chat-container-visible value value', () => {
        if (!QuiqChatClient) {
          throw new Error('Client undefined');
        }

        ChatState.chatIsVisible = false;
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

        ChatState.hasTakenMeaningfulAction = false;
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

        ChatState.chatIsVisible = true;
        ChatState.hasTakenMeaningfulAction = true;

        QuiqChatClient.initialize(host, contactPoint);
        QuiqChatClient.onTranscriptChange(onTranscriptChange);
        QuiqChatClient.onAgentTyping(onAgentTyping);
        QuiqChatClient.onError(onError);
        QuiqChatClient.onErrorResolution(onErrorResolution);
        QuiqChatClient.onReconnect(onReconnect);
        QuiqChatClient.onRegistration(onRegistration);
        QuiqChatClient.onNewSession(onNewSession);
        QuiqChatClient.onBurn(onBurn);

        if (!QuiqChatClient) {
          throw new Error('Client undefined');
        }

        ChatState.connected = true;
        QuiqChatClient.sendTextMessage('text');
      });

      it('proxies call on send message', () => {
        expect(API.sendMessage).lastCalledWith({text: 'text'});
      });

      it('sets container visibility to `true`', () => {
        expect(ChatState.chatIsVisible).toBe(true);
      });

      it('sets hasTakenMeaningfulAction to `true`', () => {
        expect(ChatState.hasTakenMeaningfulAction).toBe(true);
      });
    });

      describe('replyToRichMessage', () => {
          const replyResponse = {text: 'value'};

          beforeEach(() => {
              jest.clearAllMocks();
              API.fetchWebsocketInfo.mockReturnValue({
                  url: 'https://websocket.test',
                  protocol: 'atmosphere',
              });

              ChatState.chatIsVisible = true;
              ChatState.hasTakenMeaningfulAction = true;

              QuiqChatClient.initialize(host, contactPoint);
              QuiqChatClient.onTranscriptChange(onTranscriptChange);
              QuiqChatClient.onAgentTyping(onAgentTyping);
              QuiqChatClient.onError(onError);
              QuiqChatClient.onErrorResolution(onErrorResolution);
              QuiqChatClient.onReconnect(onReconnect);
              QuiqChatClient.onRegistration(onRegistration);
              QuiqChatClient.onNewSession(onNewSession);
              QuiqChatClient.onBurn(onBurn);

              if (!QuiqChatClient) {
                  throw new Error('Client undefined');
              }
              
              ChatState.connected = true;
              QuiqChatClient.sendQuiqReply(replyResponse);
          });

          it('proxies call on send message', () => {
              expect(API.sendMessage).toBeCalledWith(replyResponse);
          });

          it('sets container visibility to `true`', () => {
              expect(ChatState.chatIsVisible).toBe(true);
          });

          it('sets hasTakenMeaningfulAction to `true`', () => {
              expect(ChatState.hasTakenMeaningfulAction).toBe(true);
          });
      })

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
      const data = { firstName: 'SpongeBob', lastName: 'SquarePants' };
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

      it('set container visibility to true', () => {
        expect(ChatState.chatIsVisible).toBe(true);
      });
    });
  });

  describe('websocket message handling', () => {
    describe('BurnItDown message', () => {
      it('calls burnItDown', () => {
        const message: BurnItDownMessage = {
          messageType: ChatterboxMessageType.BURN_IT_DOWN,
          data: { before: 0, code: 466, force: true },
          tenantId: 'test',
        };
        // @ts-ignore private access
        QuiqChatClient._handleWebsocketMessage(message);
        expect(Utils.burnItDown).toBeCalledWith(message.data);
      });
    });

    describe('ChatMessage', () => {
      describe('REGISTER', () => {
        beforeEach(() => {
          const event: ChatMessage = {
            messageType: ChatterboxMessageType.CHAT_MESSAGE,
            tenantId: 'me!',
            data: {
              id: 'test',
              timestamp: 123,
              type: EventType.REGISTER,
            },
          };
          // @ts-ignore private access
          QuiqChatClient._handleWebsocketMessage(event);
        });

        it('sets hasTakenMeaningfulAction to true', () => {
          expect(ChatState.hasTakenMeaningfulAction).toBe(true);
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

      API.fetchWebsocketInfo.mockReturnValueOnce(Promise.reject({ status: 405 }));

      QuiqChatClient.initialize(host, contactPoint);
      QuiqChatClient.onTranscriptChange(onTranscriptChange);
      QuiqChatClient.onAgentTyping(onAgentTyping);
      QuiqChatClient.onError(onError);
      QuiqChatClient.onErrorResolution(onErrorResolution);
      QuiqChatClient.onReconnect(onReconnect);
      QuiqChatClient.onBurn(onBurn);

      QuiqChatClient.start();
    });

    it('calls disconnectSocket', () => {
      expect(QuiqSocketSingleton.disconnect).toBeCalled();
      expect(onError).not.toBeCalledWith({ status: 405 });
    });
  });

  // eslint-disable-next-line no-restricted-syntax
  xdescribe('start with non-retryable error', () => {
    beforeEach(() => {
      // Return a retryable error once
      API.fetchWebsocketInfo.mockReturnValueOnce(Promise.reject({ status: 404 }));

      QuiqChatClient.initialize(host, contactPoint);
      QuiqChatClient.onTranscriptChange(onTranscriptChange);
      QuiqChatClient.onAgentTyping(onAgentTyping);
      QuiqChatClient.onError(onError);
      QuiqChatClient.onErrorResolution(onErrorResolution);
      QuiqChatClient.onReconnect(onReconnect);
      QuiqChatClient.onBurn(onBurn);
      QuiqChatClient.start();
    });

    it('calls disconnectSocket', () => {
      expect(QuiqSocketSingleton.disconnect).toBeCalled();
    });

    it('calls onError', () => {
      expect(onError).toBeCalledWith({ status: 404 });
    });
  });
});

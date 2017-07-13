// @flow
import * as API from './apiCalls';
import {setGlobals, checkRequiredSettings} from './globals';
import {connectSocket, disconnectSocket} from './websockets';
import type {AtmosphereMessage, TextMessage, ApiError, UserEventTypes, Event} from './types';
import {MessageTypes, quiqChatVisibleCookie, quiqChatContinuationCookie} from './appConstants';
import {set, get} from 'js-cookie';
import {differenceBy, last, partition} from 'lodash';
import {sortByTimestamp} from './utils';

const getConversation = async (): Promise<{events: Array<Event>, messages: Array<TextMessage>}> => {
  const conversation = await API.fetchConversation();
  const partitionedConversation = partition(conversation.messages, {type: MessageTypes.TEXT});
  const messages = partitionedConversation[0];
  const events = partitionedConversation[1];
  return {messages, events};
};

export type QuiqChatCallbacks = {
  onNewMessages?: (messages: Array<TextMessage>) => void,
  onAgentTyping?: (typing: boolean) => void,
  onError?: (error: ?ApiError) => void,
  onErrorResolved?: () => void,
  onConnectionStatusChange?: (connected: boolean) => void,
  onBurn?: () => void,
};

class QuiqChatClient {
  host: string;
  contactPoint: string;
  callbacks: QuiqChatCallbacks;
  textMessages: Array<TextMessage>;
  events: Array<Event>;
  connected: boolean;
  userIsRegistered: boolean;

  constructor(host: string, contactPoint: string) {
    this.host = host;
    this.contactPoint = contactPoint;
    this.callbacks = {};
    this.textMessages = [];
    this.events = [];
    this.userIsRegistered = false;
    this.connected = false;

    setGlobals({
      HOST: this.host,
      CONTACT_POINT: this.contactPoint,
    });
  }

  /** Fluent client builder functions: these all return the client object **/

  onNewMessages = (callback: (messages: Array<TextMessage>) => void): QuiqChatClient => {
    this.callbacks.onNewMessages = callback;
    return this;
  };

  onAgentTyping = (callback: (typing: boolean) => void): QuiqChatClient => {
    this.callbacks.onAgentTyping = callback;
    return this;
  };

  onError = (callback: (error: ?ApiError) => void): QuiqChatClient => {
    this.callbacks.onError = callback;
    return this;
  };

  onErrorResolved = (callback: () => void): QuiqChatClient => {
    this.callbacks.onErrorResolved = callback;
    return this;
  };

  onConnectionStatusChange = (callback: (connected: boolean) => void): QuiqChatClient => {
    this.callbacks.onConnectionStatusChange = callback;
    return this;
  };

  onBurn = (callback: () => void): QuiqChatClient => {
    this.callbacks.onBurn = callback;
    return this;
  };

  start = async (): Promise<?QuiqChatClient> => {
    checkRequiredSettings();

    try {
      // Order Matters here.  Ensure we successfully complete this fetchConversation request before connecting to
      // the websocket below!
      const {messages, events} = await getConversation();

      // Process initial messages, but do not send callback. We'll send all messages in callback next.
      this._processNewMessagesAndEvents(messages, events, false);

      // Send all messages in initial newMessages callback
      if (this.callbacks.onNewMessages && this.textMessages.length)
        this.callbacks.onNewMessages(this.textMessages);

      // Establish websocket connection
      disconnectSocket(); // Ensure we only have one websocket connection open
      const wsInfo: {url: string} = await API.fetchWebsocketInfo();

      connectSocket({
        socketUrl: wsInfo.url,
        callbacks: {
          onConnectionLoss: this._handleConnectionLoss,
          onConnectionEstablish: this._handleConnectionEstablish,
          onMessage: this._handleWebsocketMessage,
        },
      });

      if (this.callbacks.onConnectionStatusChange) {
        this.callbacks.onConnectionStatusChange(true);
      }
      if (this.callbacks.onErrorResolved) {
        this.callbacks.onErrorResolved();
      }
    } catch (err) {
      console.error(err); // eslint-disable-line no-console
      disconnectSocket();
      this._handleRetryableError(err, this.start);
    }
  };

  stop = () => {
    disconnectSocket();
  };

  getMessages = async (cache: boolean = true): Promise<Array<TextMessage>> => {
    if (!cache || !this.connected) {
      const {messages, events} = await getConversation();
      this._processNewMessagesAndEvents(messages, events);
    }

    return this.textMessages;
  };

  /** API wrappers: these return Promises around the API response **/

  joinChat = () => {
    set(quiqChatVisibleCookie.id, 'true', {
      expires: quiqChatVisibleCookie.expiration,
    });
    return API.joinChat();
  };

  leaveChat = () => {
    set(quiqChatVisibleCookie.id, 'false', {
      expires: quiqChatVisibleCookie.expiration,
    });
    return API.leaveChat();
  };

  sendMessage = (text: string) => {
    set(quiqChatContinuationCookie.id, 'true', {
      expires: quiqChatContinuationCookie.expiration,
    });
    return API.addMessage(text);
  };

  updateMessagePreview = (text: string, typing: boolean) => {
    return API.updateMessagePreview(text, typing);
  };

  sendRegistration = (fields: {[string]: string}) => {
    set(quiqChatContinuationCookie.id, 'true', {
      expires: quiqChatContinuationCookie.expiration,
    });
    return API.sendRegistration(fields);
  };

  checkForAgents = () => {
    return API.checkForAgents();
  };

  isChatVisible = (): boolean => {
    return get(quiqChatVisibleCookie.id) === 'true';
  };

  hasActiveChat = async () => {
    // quiq-chat-continuation is a cookie to tell if the user has already initiated a chat
    if (get(quiqChatContinuationCookie.id) !== 'true') return false;
    if (this.textMessages.length > 0) return true;

    checkRequiredSettings();
    await this.getMessages();

    return this.textMessages.length > 0;
  };

  getLastUserEvent = async (cache: boolean = true): Promise<UserEventTypes | null> => {
    if (!cache || !this.connected) {
      const {messages, events} = await getConversation();
      this._processNewMessagesAndEvents(messages, events);
    }

    const lastStatusMessage = last(
      this.events.filter(m => m.type === MessageTypes.JOIN || m.type === MessageTypes.LEAVE),
    );
    return lastStatusMessage ? lastStatusMessage.type : null;
  };

  isRegistered = (): boolean => {
    return this.userIsRegistered;
  };

  /** Private Members **/

  _handleWebsocketMessage = (message: AtmosphereMessage) => {
    if (message.messageType === MessageTypes.CHAT_MESSAGE) {
      switch (message.data.type) {
        case MessageTypes.TEXT:
          this._processNewMessagesAndEvents([message.data]);
          break;
        case MessageTypes.JOIN:
        case MessageTypes.LEAVE:
        case MessageTypes.REGISTER:
          this._processNewMessagesAndEvents([], [message.data]);
          break;
        case MessageTypes.AGENT_TYPING:
          if (this.callbacks.onAgentTyping) {
            this.callbacks.onAgentTyping(message.data.typing);
          }
          break;
        case MessageTypes.BURN_IT_DOWN:
          // The BurnItDown script for this lives in the websockets file, but if we get this message
          // we'll want to let the app know that they're burned
          if (this.callbacks.onBurn) {
            this.callbacks.onBurn();
          }
          break;
      }
    }
  };

  _handleRetryableError = (err?: ApiError, retry?: () => ?Promise<*>) => {
    if (err && err.status && err.status > 404) {
      if (retry) {
        setTimeout(retry, 5000);
      }
    } else {
      if (this.callbacks.onError) {
        this.callbacks.onError(err);
      }
    }
  };

  _handleConnectionLoss = () => {
    this.connected = false;

    if (this.callbacks.onConnectionStatusChange) {
      this.callbacks.onConnectionStatusChange(false);
    }
  };

  _handleConnectionEstablish = async () => {
    const {messages, events} = await getConversation();

    this._processNewMessagesAndEvents(messages, events);

    this.connected = true;

    if (this.callbacks.onConnectionStatusChange) {
      this.callbacks.onConnectionStatusChange(true);
    }
  };

  _processNewMessagesAndEvents = (
    messages: Array<TextMessage>,
    events: Array<Event> = [],
    sendNewMessageCallback: boolean = true,
  ): void => {
    const newMessages = differenceBy(messages, this.textMessages, 'id');
    const newEvents = differenceBy(events, this.events, 'id');

    const sortedNewMessages = sortByTimestamp(newMessages);

    if (newMessages.length && this.callbacks.onNewMessages && sendNewMessageCallback) {
      this.callbacks.onNewMessages(sortedNewMessages);
    }

    const sortedMessages = sortByTimestamp(this.textMessages.concat(newMessages));
    const sortedEvents = sortByTimestamp(this.textMessages.concat(newEvents));

    this.textMessages = sortedMessages;
    this.events = sortedEvents;

    // Update user registration status
    this.userIsRegistered = this.events.some(e => e.type === MessageTypes.REGISTER);
  };
}

export default QuiqChatClient;

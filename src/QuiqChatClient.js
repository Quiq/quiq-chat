// @flow
import * as API from './apiCalls';
import {setGlobals} from './globals';
import {connectSocket, disconnectSocket} from './websockets';
import type {AtmosphereMessage, TextMessage, ApiError, UserEventTypes, Event} from './types';
import {MessageTypes} from './appConstants';
import {registerCallbacks, onInit} from './stubbornFetch';
import {differenceBy, unionBy, last, partition} from 'lodash';
import {sortByTimestamp} from './utils';
import type {QuiqChatCallbacks} from 'types';
import * as cookies from './cookies';

const getConversation = async (): Promise<{events: Array<Event>, messages: Array<TextMessage>}> => {
  const conversation = await API.fetchConversation();
  const partitionedConversation = partition(conversation.messages, {type: MessageTypes.TEXT});
  const messages = partitionedConversation[0];
  const events = partitionedConversation[1];
  return {messages, events};
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

    window.addEventListener('online', () => {
      this.stop();
      this.start();
      this._handleConnectionEstablish();
      if (this.callbacks.onErrorResolved) {
        this.callbacks.onErrorResolved();
      }
    });

    window.addEventListener('offline', () => {
      this._handleConnectionLoss();
      this.stop();
    });

    // Register with apiCalls for new session events
    API.registerNewSessionCallback(this._handleNewSession);
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
    registerCallbacks({onError: callback});
    return this;
  };

  onRegistration = (callback: () => void): QuiqChatClient => {
    this.callbacks.onRegistration = callback;
    return this;
  };

  onRetryableError = (callback: (error: ?ApiError) => void): QuiqChatClient => {
    this.callbacks.onRetryableError = callback;
    registerCallbacks({onRetryableError: callback});
    return this;
  };

  onErrorResolved = (callback: () => void): QuiqChatClient => {
    this.callbacks.onErrorResolved = callback;
    registerCallbacks({onErrorResolved: callback});
    return this;
  };

  onConnectionStatusChange = (callback: (connected: boolean) => void): QuiqChatClient => {
    this.callbacks.onConnectionStatusChange = callback;
    return this;
  };

  onBurn = (callback: () => void): QuiqChatClient => {
    this.callbacks.onBurn = callback;
    registerCallbacks({onBurn: callback});
    return this;
  };

  start = async (): Promise<?QuiqChatClient> => {
    try {
      // Order Matters here.  Ensure we successfully complete this fetchConversation request before connecting to
      // the websocket below!
      await API.login();
      onInit();

      const {messages, events} = await getConversation();
      // Process initial messages, but do not send callback. We'll send all messages in callback next.
      this._processNewMessagesAndEvents(messages, events, false);

      // Send all messages in initial newMessages callback
      if (this.callbacks.onNewMessages && this.textMessages.length)
        this.callbacks.onNewMessages(this.textMessages);

      disconnectSocket(); // Ensure we only have one websocket connection open
      const wsInfo: {url: string} = await API.fetchWebsocketInfo();
      this._connectSocket(wsInfo);

      if (this.callbacks.onConnectionStatusChange) {
        this.callbacks.onConnectionStatusChange(true);
      }
    } catch (err) {
      disconnectSocket();

      if (this.callbacks.onError) {
        this.callbacks.onError(err);
      }
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
    cookies.setQuiqChatContainerVisibleCookie(true);

    return API.joinChat();
  };

  leaveChat = () => {
    cookies.setQuiqChatContainerVisibleCookie(false);
    return API.leaveChat();
  };

  sendMessage = (text: string) => {
    cookies.setQuiqChatContainerVisibleCookie(true);
    cookies.setQuiqUserTakenMeaningfulActionCookie(true);
    return API.addMessage(text);
  };

  updateMessagePreview = (text: string, typing: boolean) => {
    return API.updateMessagePreview(text, typing);
  };

  sendRegistration = (fields: {[string]: string}) => {
    cookies.setQuiqChatContainerVisibleCookie(true);
    cookies.setQuiqUserTakenMeaningfulActionCookie(true);
    return API.sendRegistration(fields);
  };

  checkForAgents = () => {
    return API.checkForAgents();
  };

  isChatVisible = (): boolean => cookies.getQuiqChatContainerVisibleCookie();
  hasTakenMeaningfulAction = (): boolean => cookies.getQuiqUserTakenMeaningfulActionCookie();

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
  _connectSocket = (wsInfo: {url: string}) => {
    connectSocket({
      socketUrl: wsInfo.url,
      callbacks: {
        onConnectionLoss: this._handleConnectionLoss,
        onConnectionEstablish: this._handleConnectionEstablish,
        onMessage: this._handleWebsocketMessage,
        onBurn: this._handleBurnItDown,
      },
    });
  };

  _handleNewSession = async () => {
    // Clear message and events caches (tracking ID is different now, so we essentially have a new Conversation)
    this.textMessages = this.events = [];
    this.userIsRegistered = false;

    // Disconnect/reconnect websocket
    // (Connection establishment handler will refresh messages)
    disconnectSocket(); // Ensure we only have one websocket connection open
    const wsInfo: {url: string} = await API.fetchWebsocketInfo();
    this._connectSocket(wsInfo);
  };

  _handleWebsocketMessage = (message: AtmosphereMessage) => {
    if (message.messageType === MessageTypes.CHAT_MESSAGE) {
      switch (message.data.type) {
        case MessageTypes.TEXT:
          this._processNewMessagesAndEvents([message.data]);
          break;
        case MessageTypes.JOIN:
        case MessageTypes.LEAVE:
          this._processNewMessagesAndEvents([], [message.data]);
          break;
        case MessageTypes.REGISTER:
          if (this.callbacks.onRegistration) {
            this.callbacks.onRegistration();
          }
          this.userIsRegistered = true;
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

  _handleBurnItDown = () => {
    if (this.callbacks.onBurn) {
      this.callbacks.onBurn();
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
    const newMessages = unionBy(messages, this.textMessages, 'id');
    const newEvents = unionBy(events, this.events, 'id');

    this.textMessages = sortByTimestamp(newMessages);
    this.events = sortByTimestamp(newEvents);

    if (this.textMessages && this.callbacks.onNewMessages && sendNewMessageCallback) {
      this.callbacks.onNewMessages(this.textMessages);
    }
  };
}

export default QuiqChatClient;

// @flow
import * as API from './apiCalls';
import {setGlobals} from './globals';
import {
  connectSocket as connectAtmosphere,
  disconnectSocket as disconnectAtmosphere,
} from './websockets';
import QuiqSocket from './QuiqSockets/quiqSockets';
import {MessageTypes, MINUTES_UNTIL_INACTIVE} from './appConstants';
import {registerCallbacks, onInit, setClientInactive} from './stubbornFetch';
import type {
  ChatMessage,
  BurnItDownMessage,
  TextMessage,
  ApiError,
  UserEventTypes,
  Event,
} from './types';
import {differenceBy, unionBy, last, partition} from 'lodash';
import {sortByTimestamp, burnItDown, registerOnBurnCallback} from './Utils/utils';
import type {QuiqChatCallbacks} from 'types';
import * as storage from './storage';
import logger from './logging';
import * as Senty from './sentry';
import Raven from 'raven-js';

Senty.init();

const log = logger('QuiqChatClient');

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
  socketProtocol: ?string;
  userIsRegistered: boolean;
  trackingId: ?string;
  initialized: boolean;
  clientInactiveTimer: number;

  initialize = (host: string, contactPoint: string) => {
    this.host = host;
    this.contactPoint = contactPoint;
    this.callbacks = {};
    this.textMessages = [];
    this.events = [];
    this.userIsRegistered = false;
    this.connected = false;
    this.trackingId = null;
    this.initialized = false;

    setGlobals({
      HOST: this.host,
      CONTACT_POINT: this.contactPoint,
    });

    // Register with apiCalls for new session events
    API.registerNewSessionCallback(this._handleNewSession);
  };

  /** Fluent client builder functions: these all return the client object * */

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

  onNewSession = (callback: () => void): QuiqChatClient => {
    this.callbacks.onNewSession = callback;
    return this;
  };

  onBurn = (callback: () => void): QuiqChatClient => {
    registerOnBurnCallback(callback);
    return this;
  };

  onClientInactiveTimeout = (callback: () => void): QuiqChatClient => {
    this.callbacks.onClientInactiveTimeout = callback;
    return this;
  };

  start = async (): Promise<?QuiqChatClient> => {
    // Avoid race conditions by only running start() once
    if (this.initialized) return;

    try {
      this.initialized = true;
      setClientInactive(false);

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

      this._disconnectSocket(); // Ensure we only have one websocket connection open
      const wsInfo: {url: string, protocol: string} = await API.fetchWebsocketInfo();
      this._connectSocket(wsInfo);

      if (this.callbacks.onConnectionStatusChange) {
        this.callbacks.onConnectionStatusChange(true);
      }

      // If start is successful, begin the client inactive timer
      this._setTimeUntilInactive(MINUTES_UNTIL_INACTIVE);
    } catch (err) {
      log.error(`Could not start QuiqChatClient: ${err}`);
      this._disconnectSocket();

      if (this.callbacks.onError) {
        this.callbacks.onError(err);
      }
    }
  };

  stop = () => {
    this._disconnectSocket();
    this.initialized = false;
    this.connected = false;
  };

  getMessages = async (cache: boolean = true): Promise<Array<TextMessage>> => {
    if (!cache || !this.connected) {
      const {messages, events} = await getConversation();
      this._processNewMessagesAndEvents(messages, events);
    }

    return this.textMessages;
  };

  /** API wrappers: these return Promises around the API response * */

  joinChat = () => {
    storage.setQuiqChatContainerVisible(true);
    return API.joinChat();
  };

  leaveChat = () => {
    storage.setQuiqChatContainerVisible(false);
    return API.leaveChat();
  };

  sendMessage = (text: string) => {
    this._setTimeUntilInactive(MINUTES_UNTIL_INACTIVE);
    storage.setQuiqChatContainerVisible(true);
    storage.setQuiqUserTakenMeaningfulAction(true);
    return API.addMessage(text);
  };

  updateMessagePreview = (text: string, typing: boolean) => {
    return API.updateMessagePreview(text, typing);
  };

  sendRegistration = (fields: {[string]: string}) => {
    this._setTimeUntilInactive(MINUTES_UNTIL_INACTIVE);
    storage.setQuiqChatContainerVisible(true);
    storage.setQuiqUserTakenMeaningfulAction(true);
    return API.sendRegistration(fields);
  };

  checkForAgents = () => {
    return API.checkForAgents();
  };

  isStorageEnabled = () => storage.isStorageEnabled();
  isChatVisible = (): boolean => storage.getQuiqChatContainerVisible();
  hasTakenMeaningfulAction = (): boolean => storage.getQuiqUserTakenMeaningfulAction();

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

  /** Private Members * */
  _connectSocket = (wsInfo: {url: string, protocol: string}) => {
    this.socketProtocol = wsInfo.protocol;

    // If we didn't get protocol, or it was an unsupported value, default to 'atmosphere'
    if (!this.socketProtocol || !['atmosphere', 'quiq'].includes(this.socketProtocol)) {
      log.warn(
        `Unsupported socket protocol "${wsInfo.protocol}" received. Defaulting to "atmosphere"`,
      );
      this.socketProtocol = 'atmosphere';
    }

    log.info(`Using ${this.socketProtocol} protocol`);

    switch (this.socketProtocol) {
      case 'quiq':
        QuiqSocket.withURL(`wss://${wsInfo.url}`)
          .onConnectionLoss(this._handleConnectionLoss)
          .onConnectionEstablish(this._handleConnectionEstablish)
          .onMessage(this._handleWebsocketMessage)
          .onFatalError(this._handleFatalSocketError)
          .connect();
        break;
      case 'atmosphere':
        connectAtmosphere({
          socketUrl: wsInfo.url,
          callbacks: {
            onConnectionLoss: this._handleConnectionLoss,
            onConnectionEstablish: this._handleConnectionEstablish,
            onMessage: this._handleWebsocketMessage,
            onFatalError: this._handleFatalSocketError,
          },
        });
        break;
    }
  };

  _disconnectSocket = () => {
    QuiqSocket.disconnect();
    disconnectAtmosphere();
  };

  _handleNewSession = async (newTrackingId: string) => {
    if (this.trackingId && newTrackingId !== this.trackingId) {
      // Clear message and events caches (tracking ID is different now, so we essentially have a new Conversation)
      this.textMessages = [];
      this.events = [];
      this.userIsRegistered = false;

      if (this.callbacks.onNewSession) {
        this.callbacks.onNewSession();
      }

      // Disconnect/reconnect websocket
      // (Connection establishment handler will refresh messages)
      this._disconnectSocket(); // Ensure we only have one websocket connection open
      const wsInfo: {url: string, protocol: string} = await API.fetchWebsocketInfo();
      this._connectSocket(wsInfo);
    }

    this.trackingId = newTrackingId;
  };

  _handleWebsocketMessage = (message: ChatMessage | BurnItDownMessage) => {
    if (message.messageType === MessageTypes.CHAT_MESSAGE) {
      switch (message.data.type) {
        case MessageTypes.TEXT:
          this._processNewMessagesAndEvents([message.data]);
          storage.setQuiqUserTakenMeaningfulAction(true);
          break;
        case MessageTypes.JOIN:
        case MessageTypes.LEAVE:
          this._processNewMessagesAndEvents([], [message.data]);
          break;
        case MessageTypes.REGISTER:
          this._processNewMessagesAndEvents([], [message.data]);
          storage.setQuiqUserTakenMeaningfulAction(true);
          break;
        case MessageTypes.AGENT_TYPING:
          if (this.callbacks.onAgentTyping) {
            this.callbacks.onAgentTyping(message.data.typing);
          }
          break;
      }
    }

    if (message.messageType === MessageTypes.BURN_IT_DOWN) {
      burnItDown(message.data);
    }
  };

  _handleFatalSocketError = () => {
    burnItDown();
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
    const newMessages: Array<TextMessage> = differenceBy(messages, this.textMessages, 'id');
    const newEvents: Array<Event> = differenceBy(events, this.events, 'id');

    // Apparently, it's possible (though not common) to receive duplicate messages in transcript response.
    // We need to take union of new and current messages to account for this

    // If we found new messages, sort them, update cached textMessages, and send callback
    if (newMessages.length) {
      this.textMessages = sortByTimestamp(unionBy(this.textMessages, newMessages, 'id'));

      if (this.callbacks.onNewMessages && sendNewMessageCallback) {
        this.callbacks.onNewMessages(this.textMessages);
      }
    }

    // If we found new events, sort them, update cached events, and check if a new registration event was received. Fire callback if so.
    if (newEvents.length) {
      this.events = sortByTimestamp(unionBy(this.events, newEvents, 'id'));

      if (newEvents.find(e => e.type === MessageTypes.REGISTER)) {
        if (this.callbacks.onRegistration) {
          this.callbacks.onRegistration();
        }
        this.userIsRegistered = true;
      }
    }
  };

  _setTimeUntilInactive = (minutes: number) => {
    clearTimeout(this.clientInactiveTimer);
    this.clientInactiveTimer = setTimeout(
      async () => {
        // Leaving a console log in to give context to the atmosphere console message 'Websocket closed normally'
        log.info('Client timeout due to inactivity. Closing websocket.');
        await this.leaveChat();
        this.stop();
        if (this.callbacks.onClientInactiveTimeout) {
          this.callbacks.onClientInactiveTimeout();
        }
        setClientInactive(true);
      },
      minutes * 60 * 1000 + 1000, // add a second to avoid timing issues
    );
  };
}

export default new QuiqChatClient();

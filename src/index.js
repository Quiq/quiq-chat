// @flow
import * as API from './apiCalls';
import {setGlobals} from './globals';
import {
  connectSocket as connectAtmosphere,
  disconnectSocket as disconnectAtmosphere,
} from './websockets';
import QuiqSocket from './QuiqSockets/quiqSockets';
import {MessageTypes} from './appConstants';
import {registerCallbacks, onInit, setClientInactive} from './stubbornFetch';
import differenceBy from 'lodash/differenceBy';
import unionBy from 'lodash/unionBy';
import partition from 'lodash/partition';
import throttle from 'lodash/throttle';
import {
  sortByTimestamp,
  burnItDown,
  registerOnBurnCallback,
  isSupportedBrowser as supportedBrowser,
} from './Utils/utils';
import * as S3 from './services/S3';
import type {
  ConversationElement,
  ConversationMessage,
  BurnItDownMessage,
  ApiError,
  Event,
  QuiqChatCallbacks,
  ConversationResult,
  EmailTranscriptPayload,
} from './types';
import * as storage from './storage';
import logger from './logging';
import * as Senty from './sentry';

Senty.init();

const log = logger('QuiqChatClient');

const getConversation = async (): Promise<ConversationResult> => {
  const conversationMessageTypes = [MessageTypes.TEXT, MessageTypes.ATTACHMENT];
  const conversation = await API.fetchConversation();
  const partitionedConversation = partition(conversation.messages, m =>
    conversationMessageTypes.includes(m.type),
  );
  const messages = partitionedConversation[0];
  const events = partitionedConversation[1];
  return {
    messages,
    events,
    isSubscribed: conversation.subscribed,
    isRegistered: conversation.registered,
    queueDisposition: conversation.queueDisposition,
  };
};

class QuiqChatClient {
  host: string;
  contactPoint: string;
  socketProtocol: ?string;
  callbacks: QuiqChatCallbacks = {};
  messages: Array<ConversationMessage> = [];
  events: Array<Event> = [];
  connected: boolean = false;
  userIsRegistered: boolean = false;
  agentIsAssigned: boolean = false;
  trackingId: ?string = null;
  initialized: boolean = false;

  initialize = (host: string, contactPoint: string) => {
    this.host = host;
    this.contactPoint = contactPoint;

    setGlobals({
      HOST: this.host,
      CONTACT_POINT: this.contactPoint,
    });

    // Register with apiCalls for new session events
    API.registerNewSessionCallback(this._handleNewSession);
  };

  /** Fluent client builder functions: these all return the client object * */

  onNewMessages = (callback: (messages: Array<ConversationMessage>) => void): QuiqChatClient => {
    this.callbacks.onNewMessages = callback;
    return this;
  };

  onMessageSendFailure = (callback: (messageId: string) => void): QuiqChatClient => {
    this.callbacks.onMessageSendFailure = callback;
    return this;
  };

  onAgentTyping = (callback: (typing: boolean) => void): QuiqChatClient => {
    this.callbacks.onAgentTyping = callback;
    return this;
  };

  onSendTranscript = (callback: (event: Event) => void): QuiqChatClient => {
    this.callbacks.onSendTranscript = callback;
    return this;
  };

  onAgentEndedConversation = (callback: (event: Event) => void): QuiqChatClient => {
    this.callbacks.onAgentEndedConversation = callback;
    return this;
  };

  onChatMarkedAsSpam = (callback: () => void): QuiqChatClient => {
    this.callbacks.onChatMarkedAsSpam = callback;
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

  onAgentAssigned = (callback: (connected: boolean) => void): QuiqChatClient => {
    this.callbacks.onAgentAssigned = callback;
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

      await this._getConversationAndConnect();
    } catch (err) {
      log.error(`Could not start QuiqChatClient: ${err.message}`, {exception: err});
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

  getMessages = async (cache: boolean = true): Promise<Array<ConversationMessage>> => {
    if (!cache || !this.connected) {
      const conversation = await getConversation();
      this._processConversationResult(conversation);
    }

    return this.messages;
  };

  // This is specific to our chat client. Don't document it.
  getChatConfiguration = () => API.getChatConfiguration();

  /** API wrappers: these return Promises around the API response * */
  joinChat = async () => {
    await this.getMessages();

    // These events are going to be managed entirely by the server in the near future.
    // For now, we have this logic in place to prevent multiple join events from showing
    // up on page turns.
    if (!this._hasUserJoinedConversation()) {
      storage.setQuiqChatContainerVisible(true);
      return API.joinChat();
    }
  };

  leaveChat = (synchronous: boolean = false) => {
    storage.setQuiqChatContainerVisible(false);
    return API.leaveChat(synchronous);
  };

  sendTextMessage = async (text: string) => {
    if (!this.connected) {
      await this._connectSocket();
      storage.setQuiqChatContainerVisible(true);
      storage.setQuiqUserIsSubscribed(true);
      return API.sendTextMessage(text);
    }

    storage.setQuiqChatContainerVisible(true);
    storage.setQuiqUserIsSubscribed(true);

    return API.sendTextMessage(text);
  };

  emailTranscript = async (data: EmailTranscriptPayload) => {
    return API.emailTranscript(data);
  };

  sendAttachmentMessage = async (
    file: File,
    progressCallback: (progress: number) => void,
  ): Promise<string> => {
    if (!this.connected) {
      await this._connectSocket();
      storage.setQuiqChatContainerVisible(true);
      storage.setQuiqUserIsSubscribed(true);
    }

    // Returns an array of directives, but we'll always be asking for only 1 here
    const uploadDirectives = await API.getAttachmentMessageUploadDirectives();
    const uploadDirective = uploadDirectives.uploads[0];
    const {url, formEntries} = uploadDirective.directive;
    try {
      await S3.uploadAttachment(file, url, formEntries, progressCallback);
    } catch (e) {
      log.error(`An error sending attachment message: ${e.message}`, {exception: e});
      throw e;
    }
    const {id} = await API.sendAttachmentMessage(uploadDirective.uploadId);

    return id;
  };

  updateTypingIndicator = (text: string, typing: boolean) => {
    return API.updateTypingIndicator(text, typing);
  };

  sendRegistration = async (fields: {[string]: string}) => {
    storage.setQuiqChatContainerVisible(true);
    const result = await API.sendRegistration(fields);

    if (this.callbacks.onRegistration) {
      this.callbacks.onRegistration();
    }

    return result;
  };

  getHandle = throttle((host?: string) => storage.getTrackingId() || API.login(host), 10000, {
    trailing: false,
  });

  checkForAgents = throttle(API.checkForAgents, 10000, {trailing: false});
  isStorageEnabled = () => storage.isStorageEnabled();
  isSupportedBrowser = () => supportedBrowser();
  isChatVisible = (): boolean => storage.getQuiqChatContainerVisible();
  setChatVisible = (visible: boolean) => storage.setQuiqChatContainerVisible(visible);
  hasTakenMeaningfulAction = (): boolean => storage.getQuiqUserTakenMeaningfulAction();
  isUserSubscribed = (): boolean => storage.getQuiqUserIsSubscribed();

  isRegistered = (): boolean => {
    return this.userIsRegistered;
  };

  isAgentAssigned = (): boolean => {
    return this.agentIsAssigned;
  };

  _processQueueDisposition = (queueDisposition: string) => {
    const wasAssigned = this.agentIsAssigned;
    this.agentIsAssigned = queueDisposition === 'assigned';

    if (wasAssigned !== this.agentIsAssigned && this.callbacks.onAgentAssigned) {
      this.callbacks.onAgentAssigned(this.agentIsAssigned);
    }
  };

  _getConversationAndConnect = async () => {
    const conversation = await getConversation();

    // Process initial messages, but do not send callback. We'll send all messages in callback next.
    this._processConversationResult(conversation, false);

    // Send all messages in initial newMessages callback
    if (this.callbacks.onNewMessages && this.messages.length) {
      this.callbacks.onNewMessages(this.messages);
    }

    storage.setQuiqUserIsSubscribed(conversation.isSubscribed);
    if (conversation.isSubscribed) {
      await this._connectSocket();
    }
  };

  _hasUserJoinedConversation = (): boolean => {
    if (!this.events) {
      return false;
    }

    const joinOrLeaveEvents = this.events.filter(e =>
      [MessageTypes.JOIN, MessageTypes.LEAVE].includes(e.type),
    );

    return (
      joinOrLeaveEvents.length > 0 &&
      joinOrLeaveEvents[joinOrLeaveEvents.length - 1].type === MessageTypes.JOIN
    );
  };

  /** Private Members * */
  _withSentryMetadataCallback = (callback: () => Object) => {
    this.callbacks.sentryMetadata = callback;
  };

  /**
   * Returns an object of state information, useful for logging errors.
   * @private
   */
  _getState = (): Object => {
    return {
      clientState: this.callbacks.sentryMetadata ? this.callbacks.sentryMetadata() : null,
      connected: this.connected,
      initialized: this.initialized,
      events: this.events,
    };
  };

  _connectSocket = (): Promise<*> =>
    API.fetchWebsocketInfo()
      .then(({url, protocol}: {url: string, protocol: string}) => {
        return new Promise(resolve => {
          this.socketProtocol = protocol;

          // Ensure we only have one websocket connection open
          this._disconnectSocket();

          // If we didn't get protocol, or it was an unsupported value, default to 'atmosphere'
          if (!this.socketProtocol || !['atmosphere', 'quiq'].includes(this.socketProtocol)) {
            log.warn(
              `Unsupported socket protocol "${protocol}" received. Defaulting to "atmosphere"`,
            );
            this.socketProtocol = 'atmosphere';
          }

          log.info(`Using ${this.socketProtocol} protocol`);

          const connectionEstablish = () => {
            resolve();
            this._handleConnectionEstablish();
          };

          switch (this.socketProtocol) {
            case 'quiq':
              QuiqSocket.withURL(`wss://${url}`)
                .onConnectionLoss(this._handleConnectionLoss)
                .onConnectionEstablish(connectionEstablish)
                .onMessage(this._handleWebsocketMessage)
                .onFatalError(this._handleFatalSocketError)
                .connect();
              break;
            case 'atmosphere':
              connectAtmosphere({
                socketUrl: url,
                callbacks: {
                  onConnectionLoss: this._handleConnectionLoss,
                  onConnectionEstablish: connectionEstablish,
                  onMessage: this._handleWebsocketMessage,
                  onFatalError: this._handleFatalSocketError,
                },
              });
              break;
          }
        });
      })
      .catch(e => {
        log.info('Unable to establish websocket connection', {data: {e}});
        if (this.callbacks.onError) this.callbacks.onError();
        return Promise.reject(e);
      });

  _disconnectSocket = () => {
    QuiqSocket.disconnect();
    disconnectAtmosphere();
  };

  _handleNewSession = async (newTrackingId: string) => {
    if (this.trackingId && newTrackingId !== this.trackingId) {
      // Clear message and events caches (tracking ID is different now, so we essentially have a new Conversation)
      this.messages = [];
      this.events = [];
      this.userIsRegistered = false;

      if (this.callbacks.onNewSession) {
        this.callbacks.onNewSession();
      }

      this.trackingId = newTrackingId;

      const conversation = await getConversation();

      storage.setQuiqUserIsSubscribed(conversation.isSubscribed);
      if (conversation.isSubscribed) {
        await this._connectSocket();
      } else {
        this._disconnectSocket();

        // Need to notify the client that we are not in a loading state at this point,
        // otherwise the spinner will continue to show.
        if (this.callbacks.onConnectionStatusChange) {
          this.callbacks.onConnectionStatusChange(true);
        }
      }
    } else {
      this.trackingId = newTrackingId;
    }
  };

  _handleWebsocketMessage = (message: ConversationElement | BurnItDownMessage) => {
    if (message.messageType === MessageTypes.CHAT_MESSAGE) {
      switch (message.data.type) {
        case MessageTypes.TEXT:
        case MessageTypes.ATTACHMENT:
          this._processNewMessages([message.data]);
          break;
        case MessageTypes.FAILED:
          this._handleMessageFailure(message.data.id);
          break;
        case MessageTypes.JOIN:
        case MessageTypes.LEAVE:
          this._processNewEvents([message.data]);
          break;
        case MessageTypes.REGISTER:
          this._processNewEvents([message.data]);
          if (!this.userIsRegistered) {
            this.userIsRegistered = true;
            if (this.callbacks.onRegistration) {
              this.callbacks.onRegistration();
            }
          }
          break;
        case MessageTypes.AGENT_TYPING:
          if (this.callbacks.onAgentTyping) {
            this.callbacks.onAgentTyping(message.data.typing);
          }
          break;
        case MessageTypes.ENDED:
          this._agentEndedConversation(message.data);
          break;
        case MessageTypes.SPAM:
          this._agentEndedConversation(message.data);
          this._chatMarkedAsSpam();
          break;
        case MessageTypes.SEND_TRANSCRIPT:
          if (this.callbacks.onSendTranscript) {
            this.callbacks.onSendTranscript(message.data);
          }
          break;
      }
    }

    if (message.messageType === MessageTypes.QUEUE_DISPOSITION) {
      this._processQueueDisposition(message.data);
    }

    if (message.messageType === MessageTypes.BURN_IT_DOWN) {
      burnItDown(message.data);
    }

    if (message.messageType === MessageTypes.UNSUBSCRIBE) {
      this._unsusbscribeFromChat();
    }
  };

  _agentEndedConversation = (event: Event) => {
    if (this.callbacks.onAgentEndedConversation) {
      this.callbacks.onAgentEndedConversation(event);
    }
  };

  _chatMarkedAsSpam = () => {
    if (this.callbacks.onChatMarkedAsSpam) {
      this.callbacks.onChatMarkedAsSpam();
    }
  };

  _unsusbscribeFromChat = () => {
    this.stop();
    storage.setQuiqUserIsSubscribed(false);
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
    const conversation = await getConversation();

    this._processConversationResult(conversation);

    this.connected = true;

    if (this.callbacks.onConnectionStatusChange) {
      this.callbacks.onConnectionStatusChange(true);
    }
  };

  _handleMessageFailure = (failedMessageId: string) => {
    // Remove failed message and fire onMessageFailure callback
    const failedIdx = this.messages.findIndex(m => m.id === failedMessageId);
    if (failedIdx > -1) {
      // NOTE: splice mutates original array
      this.messages.splice(failedIdx, 1);
    }

    if (this.callbacks.onMessageSendFailure) {
      this.callbacks.onMessageSendFailure(failedMessageId);
    }
  };

  _processNewMessages = (
    newMessages: Array<ConversationMessage>,
    sendNewMessageCallback: boolean = true,
  ): void => {
    const newFilteredMessages: Array<ConversationMessage> = differenceBy(
      newMessages,
      this.messages,
      'id',
    );

    // If we found new messages, sort them, update cached textMessages, and send callback
    if (newFilteredMessages.length > 0) {
      this.messages = sortByTimestamp(unionBy(this.messages, newFilteredMessages, 'id'));

      if (this.callbacks.onNewMessages && sendNewMessageCallback) {
        this.callbacks.onNewMessages(this.messages);
      }
    }
  };

  _processNewEvents = (newEvents: Array<Event>): void => {
    const newFilteredEvents: Array<Event> = differenceBy(newEvents, this.events, 'id');

    // If we found new events, sort them, update cached events, and check if a new registration event was received. Fire callback if so.
    if (newFilteredEvents.length > 0) {
      this.events = sortByTimestamp(unionBy(this.events, newEvents, 'id'));

      const sendTranscriptEvents = newFilteredEvents.filter(
        e => e.type === MessageTypes.SEND_TRANSCRIPT,
      );

      if (sendTranscriptEvents.length) {
        sendTranscriptEvents.forEach((e: Event) => {
          if (this.callbacks.onSendTranscript) this.callbacks.onSendTranscript(e);
        });
      }

      if (newFilteredEvents.find(e => e.type === MessageTypes.SPAM)) {
        this._chatMarkedAsSpam();
      }
    }
  };

  _processConversationResult = (
    conversation: ConversationResult,
    sendNewMessageCallback: boolean = true,
  ): void => {
    this._processQueueDisposition(conversation.queueDisposition);

    if (conversation.messages.length) {
      this._processNewMessages(conversation.messages, sendNewMessageCallback);
    }

    if (conversation.events.length) {
      this._processNewEvents(conversation.events);
    }

    if (conversation.isRegistered && !this.userIsRegistered) {
      if (this.callbacks.onRegistration) {
        this.callbacks.onRegistration();
      }
    }

    this.userIsRegistered = conversation.isRegistered;
  };
}

export default new QuiqChatClient();

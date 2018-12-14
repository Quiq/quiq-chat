import * as API from './apiCalls';
import QuiqSocket from './services/QuiqSocketSingleton';
import { Events as QuiqSocketEvents } from 'quiq-socket';
import unionBy from 'lodash/unionBy';
import throttle from 'lodash/throttle';
import {
  burnItDown,
  createGuid,
  getTenantFromHostname,
  isSupportedBrowser as supportedBrowser,
  parseUrl,
  registerOnBurnCallback,
  sortByTimestamp,
} from './Utils/utils';
import * as S3 from './services/S3';
import {
  ApiError,
  Author,
  AuthorType,
  ChatMetadata,
  ChatterboxMessage,
  ChatterboxMessageType,
  Conversation,
  ConversationMessageType,
  EmailTranscriptPayload,
  EventType,
  MessageFailureData,
  PersistentData,
  QueueDisposition,
  QueueInfo,
  QuiqChatCallbacks,
  QuiqJwt,
  ReplyResponse,
  TranscriptItem,
  Context,
} from './types';
import { registerCallbacks as registerQuiqFetchCallbacks } from './quiqFetch';
import * as storage from './storage/index';
import {StorageMode, PersistedData, isStorageEnabled} from './storage';
import logger from './logging';
import { MessageFailureCodes } from './appConstants';
import { version } from '../package.json';
import ChatState, { watch as watchState, initialize as initializeChatState } from './State';
import jwt_decode from 'jwt-decode';
import * as LogListener from './Utils/logListenerPlugin';

const log = logger('QuiqChatClient');

class QuiqChatClient {
  socketProtocol: string;
  initialized: boolean;
  callbacks: QuiqChatCallbacks = {};
  transcript: Array<TranscriptItem> = [];

  initialize = async (host: string, contactPoint: string, initialPersistedData?: PersistedData) => {
    // If local storage is disabled/inaccessible, quiq-chat cannot function.
    if (!isStorageEnabled()) {
      throw new Error('Cannot initialize quiq-chat: local storage is not accessible');
    }
    
    const parsedHost = parseUrl(host);
    // Order matters here--we need configuration to setup storage, we need storage set up to initialize ChatState
    // Retrieve configuration
    const configuration = await API.getChatConfiguration(parsedHost, contactPoint);

    // Set storage mode from configuration
    const storageMode = configuration.configs.CHAT_STORAGE_MODE || StorageMode.LOCAL;
    storage.initialize(storageMode, contactPoint, initialPersistedData);

    // Initialize ChatState
    initializeChatState();

    // Save configuration in state
    ChatState.configuration = configuration;

    // Set global options in state
    // NOTE HARD: Must be done prior to any networking/business logic!
    ChatState.host = parsedHost;
    ChatState.contactPoint = contactPoint;
    ChatState.reconnecting = false;

    // Set trackingId from accessToken, if accessToken is defined
    if (ChatState.accessToken) {
      ChatState.trackingId = jwt_decode<QuiqJwt>(ChatState.accessToken).sub;
    }

    // Register with apiCalls for new session events
    API.registerNewSessionCallback(this._handleNewSession);

    return this;
  };

  /** Fluent client builder functions: these all return the client object * */

  onTranscriptChange = (callback: (messages: Array<TranscriptItem>) => void): QuiqChatClient => {
    this.callbacks.onTranscriptChanged = callback;
    return this;
  };

  onMessageSendFailure = (
    callback: (messageId: string, data: MessageFailureData) => void,
  ): QuiqChatClient => {
    this.callbacks.onMessageSendFailure = callback;
    return this;
  };

  onAgentTyping = (callback: (typing: boolean, author: Author) => void): QuiqChatClient => {
    this.callbacks.onAgentTyping = callback;
    return this;
  };

  onError = (callback: (error?: ApiError) => void): QuiqChatClient => {
    this.callbacks.onError = callback;

    registerQuiqFetchCallbacks({ onError: callback });

    return this;
  };

  onErrorResolution = (callback: () => void): QuiqChatClient => {
    this.callbacks.onErrorResolution = callback;
    registerQuiqFetchCallbacks({ onErrorResolved: callback });
    return this;
  };

  onRegistration = (callback: (registrationData: Object) => void): QuiqChatClient => {
    this.callbacks.onRegistration = callback;
    return this;
  };

  onAgentAssignmentChange = (callback: (data: { assigned: boolean }) => void): QuiqChatClient => {
    watchState('agentIsAssigned', assigned => callback({ assigned: !!assigned }));
    return this;
  };

  onChatStatusChange = (callback: (status: { active: boolean }) => void): QuiqChatClient => {
    watchState('subscribed', subscribed => callback({ active: !!subscribed }));
    return this;
  };

  onEstimatedWaitTimeChange = (callback: (estimatedWaitTime?: number) => void): QuiqChatClient => {
    watchState('estimatedWaitTime', waitTime => callback(waitTime));
    return this;
  };

  onReconnect = (callback: (reconnecting: boolean) => void): QuiqChatClient => {
    watchState('reconnecting', reconnecting => callback(!!reconnecting));
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

  onPersistentDataChange = (callback: (data: PersistentData) => void): QuiqChatClient => {
    storage.registerCallbacks({ onPersistentDataChange: callback });
    this.callbacks.onPersistentDataChange = callback;
    return this;
  };

  start = async (): Promise<QuiqChatClient> => {
    // Avoid race conditions by only running start() once
    if (this.initialized) return this;

    try {
      this.initialized = true;

      // Get a session (or refresh existing)
      await API.login();

      // Perform initial fetch of conversation
      await this._getConversationAndConnect();
    } catch (err) {
      log.error('Could not start QuiqChatClient', {
        exception: err,
        logOptions: { frequency: 'history', logFirstOccurrence: true },
      });
      this._disconnectSocket();

      if (this.callbacks.onError) {
        this.callbacks.onError(err);
      }
    }
    return this;
  };

  stop = () => {
    this._disconnectSocket();
    this.initialized = false;
    this._resetState();
  };

  getPersistentData = (): PersistentData => storage.getAll() || {};

  setCustomPersistentData = (key: string, value: any) =>
    (ChatState.customPersistedData = Object.assign({}, ChatState.customPersistedData, {
      [key]: value,
    }));

  getCustomPersistentData = (key: string) => (ChatState.customPersistedData || {})[key];

  getTranscript = async (cache: boolean = true): Promise<Array<TranscriptItem>> => {
    if (!cache || !ChatState.connected) {
      await this._loadCurrentConversation();
    }

    return this.transcript;
  };

  // This is specific to our chat client. Don't document it.
  getChatConfiguration = (): ChatMetadata | undefined => ChatState.configuration;

  getTenantVanityName = (): string | undefined =>
    ChatState.host ? getTenantFromHostname(ChatState.host.rawUrl) : undefined;

  setChatContext = (context: Context) =>
    (ChatState.context = Object.assign({}, ChatState.context, context));

  private _prepareForMessageSend = async () => {
    if (!ChatState.connected) {
      await this._connectSocket();
    }

    // Set these AFTER connection routine, as the fetched transcript might still indicate subscription == false
    // if no messages have been sent yet
    ChatState.chatIsVisible = true;
    ChatState.subscribed = true;
  };

  sendTextMessage = async (text: string) => {
    await this._prepareForMessageSend();
    return API.sendMessage({ text });
  };

  sendQuiqReply = async (reply: ReplyResponse) => {
    await this._prepareForMessageSend();
    return API.sendMessage(reply);
  };

  sendAttachmentMessage = async (
    file: File,
    progressCallback: (progress: number) => void,
  ): Promise<string> => {
    await this._prepareForMessageSend();

    // Returns an array of directives, but we'll always be asking for only 1 here
    const uploadDirectives = await API.getAttachmentMessageUploadDirectives();
    const uploadDirective = uploadDirectives.uploads[0];
    const { url, formEntries } = uploadDirective.directive;
    try {
      await S3.uploadAttachment(file, url, formEntries, progressCallback);
    } catch (e) {
      log.error('An occurred error sending attachment message', {
        exception: e,
        logOptions: { frequency: 'history', logFirstOccurrence: true },
      });
      throw e;
    }
    const { id } = await API.sendAttachmentMessage(uploadDirective.uploadId);

    return id;
  };

  emailTranscript = async (data: EmailTranscriptPayload) => {
    await API.emailTranscript(data);
    // If we're not currently subscribed, add an optimistic 'Send Transcript' event
    if (!this.isUserSubscribed()) {
      this._ingestTranscriptItems([
        {
          authorType: AuthorType.USER,
          id: createGuid(),
          timestamp: Date.now(),
          type: EventType.SEND_TRANSCRIPT,
        },
      ]);
    }
  };

  updateTypingIndicator = (text: string, typing: boolean) =>
    API.updateTypingIndicator(text, typing);

  sendRegistration = async (fields: { [fieldId: string]: string }, formVersionId?: string) => {
    if (!fields || !Object.keys(fields).length) {
      log.error('Cannot send registration without at least one field/value pair', {
        logOptions: { frequency: 'history', logFirstOccurrence: true },
      });
      return;
    }

    ChatState.chatIsVisible = true;
    await API.sendRegistration(fields, formVersionId);

    ChatState.userIsRegistered = true;

    // Fire registration callback if user just became registered
    if (this.callbacks.onRegistration) {
      this.callbacks.onRegistration(fields);
    }
  };

  getHandle = () => ChatState.trackingId;

  login = throttle(async () => (await API.login()).trackingId, 10000, {
    trailing: false,
  });

  checkForAgents = throttle(API.checkForAgents, 10000, { trailing: false });
  isStorageEnabled = () => storage.isStorageEnabled();
  isSupportedBrowser = () => supportedBrowser();
  isChatVisible = (): boolean => !!ChatState.chatIsVisible;
  setChatVisible = (visible: boolean) => {
    ChatState.chatIsVisible = visible;
  };
  hasTakenMeaningfulAction = (): boolean => !!ChatState.hasTakenMeaningfulAction;
  isUserSubscribed = (): boolean => !!ChatState.subscribed;
  getEstimatedWaitTime = (): number | undefined => ChatState.estimatedWaitTime;

  isRegistered = (): boolean => !!ChatState.userIsRegistered;

  isAgentAssigned = (): boolean => !!ChatState.agentIsAssigned;

  private _resetState = () => {
    this.transcript = [];
    ChatState.userIsRegistered = false;
    ChatState.agentIsAssigned = false;
    ChatState.estimatedWaitTime = undefined;
  };

  // @ts-ignore no-unused-variable
  private _withLogListener = (callback: LogListener.LogFunction): QuiqChatClient => {
    LogListener.addListener(callback);
    return this;
  };

  // @ts-ignore no-unused-variable
  private _loadCurrentConversation = async () => {
    const conversation = await API.fetchConversation();
    this._processConversation(conversation);
  };

  // @ts-ignore no-unused-variable
  private _deepGetUserSubscribed = async (): Promise<boolean> => {
    await this._loadCurrentConversation();
    return this.isUserSubscribed();
  };

  // @ts-ignore no-unused-variable
  private _getConversationAndConnect = async () => {
    await this._loadCurrentConversation();

    if (this.isUserSubscribed()) {
      await this._connectSocket();
    }
  };

  // @ts-ignore no-unused-variable
  private _hasUserJoinedConversation = (): boolean => {
    if (!this.transcript) {
      return false;
    }

    const joinOrLeaveEvents = this.transcript.filter(e =>
      // @ts-ignore we don't care that e.type might not be an EventType
      [EventType.JOIN, EventType.LEAVE].includes(e.type),
    );

    return (
      joinOrLeaveEvents.length > 0 &&
      joinOrLeaveEvents[joinOrLeaveEvents.length - 1].type === EventType.JOIN
    );
  };

  // @ts-ignore no-unused-variable
  private _connectSocket = (): Promise<void | {}> =>
    API.fetchWebsocketInfo()
      .then(
        socketInfo =>
          new Promise(resolve => {
            const { url, protocol } = socketInfo;
            this.socketProtocol = socketInfo.protocol;

            // Ensure we only have one websocket connection open
            this._disconnectSocket();

            // If we didn't get protocol, or it was an unsupported value, default to 'atmosphere'
            if (!this.socketProtocol || !['quiq'].includes(this.socketProtocol)) {
              log.warn(`Unsupported socket protocol "${protocol}" received. Defaulting to "quiq"`, {
                logOptions: { frequency: 'history', logFirstOccurrence: true },
              });
              this.socketProtocol = 'quiq';
            }

            log.info(`Using ${this.socketProtocol} protocol`);

            const connectionEstablish = async () => {
              await this._handleConnectionEstablish();
              resolve();
            };

            switch (this.socketProtocol) {
              case 'quiq':
                QuiqSocket.withURL(`wss://${url}`)
                  .withLogger(log)
                  .withOptions({
                    connectionGuardHook: () => !ChatState.burned,
                    protocolHook: () => ChatState.accessToken,
                    queryArgHook: () => ({
                      trackingId: ChatState.trackingId || 'noAssociatedTrackingId',
                      quiqVersion: version,
                    }),
                  })
                  .addEventListener(QuiqSocketEvents.CONNECTION_LOSS, this._handleConnectionLoss)
                  .addEventListener(QuiqSocketEvents.CONNECTION_ESTABLISH, connectionEstablish)
                  .addEventListener(QuiqSocketEvents.MESSAGE, this._handleWebsocketMessage)
                  .addEventListener(QuiqSocketEvents.FATAL_ERROR, this._handleFatalSocketError)
                  .connect();
                break;
              default:
                log.error(
                  `Received unknown socket protocol "${this.socketProtocol || 'unknown'}"`,
                  { logOptions: { frequency: 'history', logFirstOccurrence: true } },
                );
            }
          }),
      )
      .catch((e: Error) => {
        log.info('Unable to establish websocket connection', { context: { e } });
        if (this.callbacks.onError) this.callbacks.onError();
        return Promise.reject(e);
      });

  // @ts-ignore no-unused-variable
  private _disconnectSocket = () => {
    ChatState.connected = false;
    ChatState.reconnecting = false;
    QuiqSocket.disconnect();
  };

  // @ts-ignore no-unused-variable
  private _handleNewSession = async (newTrackingId: string) => {
    if (ChatState.trackingId && newTrackingId !== ChatState.trackingId) {
      this.stop();

      if (this.callbacks.onNewSession) {
        this.callbacks.onNewSession();
      }
    }

    ChatState.trackingId = newTrackingId;
  };

  // @ts-ignore no-unused-variable
  private _handleWebsocketMessage = (message: ChatterboxMessage) => {
    if (message.messageType === ChatterboxMessageType.CHAT_MESSAGE) {
      switch (message.data.type) {
        case ConversationMessageType.TEXT:
        case ConversationMessageType.ATTACHMENT:
        case ConversationMessageType.RICH:
        case EventType.JOIN:
        case EventType.LEAVE:
        case EventType.END:
        case EventType.SPAM:
        case EventType.SEND_TRANSCRIPT:
          this._ingestTranscriptItems([message.data]);
          break;
        case EventType.REGISTER:
          this._ingestTranscriptItems([message.data]);
          // Fire registration callback if user just became registered
          if (this.callbacks.onRegistration && !ChatState.userIsRegistered) {
            this.callbacks.onRegistration();
          }
          ChatState.userIsRegistered = true;
          break;
        case EventType.FAILED:
          this._handleMessageFailure(message.data.id, message.data.errorCode);
          break;
        case ConversationMessageType.AGENT_TYPING:
          if (this.callbacks.onAgentTyping) {
            this.callbacks.onAgentTyping(message.data.typing, {
              authorType: message.data.authorType,
              authorDisplayName: message.data.authorDisplayName,
              authorProfilePicture: message.data.authorProfilePicture,
            });
          }
          break;
        default:
          // @ts-ignore We know type still exists on data
          log.error(`Received a websocket message of unknown type ${message.data.type}`, {
            logOptions: { frequency: 'history', logFirstOccurrence: true },
          });
      }
    }

    if (message.messageType === ChatterboxMessageType.QUEUE_DISPOSITION) {
      this._processQueueDisposition(message.data);
    }

    if (message.messageType === ChatterboxMessageType.QUEUE_INFO) {
      this._processQueueInfo(message.data);
    }

    if (message.messageType === ChatterboxMessageType.BURN_IT_DOWN) {
      burnItDown(message.data);
    }

    if (message.messageType === ChatterboxMessageType.UNSUBSCRIBE) {
      this._unsubscribeFromChat();
    }
  };

  // @ts-ignore no-unused-variable
  private _unsubscribeFromChat = () => {
    this.stop();
    ChatState.subscribed = false;
  };

  // @ts-ignore no-unused-variable
  private _handleFatalSocketError = () => {
    burnItDown();
  };

  // @ts-ignore no-unused-variable
  private _handleConnectionLoss = () => {
    ChatState.connected = false;
    ChatState.reconnecting = true;
  };

  // @ts-ignore no-unused-variable
  private _handleConnectionEstablish = async () => {
    await this._loadCurrentConversation();
    ChatState.connected = true;
    ChatState.reconnecting = false;
  };

  // @ts-ignore no-unused-variable
  private _handleMessageFailure = (failedMessageId: string, code: number) => {
    // Remove failed message and fire onMessageFailure callback
    const failedIdx = this.transcript.findIndex(m => m.id === failedMessageId);
    if (failedIdx > -1) {
      // NOTE: splice mutates original array
      this.transcript.splice(failedIdx, 1);
    }

    if (this.callbacks.onMessageSendFailure) {
      this.callbacks.onMessageSendFailure(failedMessageId, {
        reason: MessageFailureCodes[code] || 'UNKNOWN',
      });
    }
  };

  // TODO: Remove this method when CB stops sending duplicate messages for rich interactions
  private _removeItemsWithDuplicateIdsPrioritizingRichMessages = (
    items: TranscriptItem[],
  ): TranscriptItem[] => {
    // We remove messages with duplicate IDs that DO NOT have a type of RICH, i.e., we remove the duplicate TEXT message
    const countsById: { [id: string]: number } = items.reduce(
      (counts: { [id: string]: number }, item) => ({
        ...counts,
        [item.id]: counts[item.id] ? counts[item.id] + 1 : 1,
      }),
      {},
    );
    return items.filter(
      (item: TranscriptItem) =>
        countsById[item.id] < 2 || item.type === ConversationMessageType.RICH,
    );
  };

  // @ts-ignore no-unused-variable
  private _ingestTranscriptItems = (
    newItems: Array<TranscriptItem>,
    sendNewMessageCallback: boolean = true,
  ): void => {
    // Sort and update cached textMessages, and send callback
    // Union removes duplicates; order is important--newItems must be passed to union before existing transcript
    // TODO: This filtering logic is needed as long as CB sends us duplicate messages for rich interactions
    // TODO: Remove when we use type TEXT for all messages
    const uniqueNewItems = this._removeItemsWithDuplicateIdsPrioritizingRichMessages(newItems);

    this.transcript = sortByTimestamp(unionBy(uniqueNewItems, this.transcript, 'id'));

    if (this.callbacks.onTranscriptChanged && sendNewMessageCallback) {
      this.callbacks.onTranscriptChanged(this.transcript);
    }
  };

  // @ts-ignore no-unused-variable
  private _processQueueInfo = (queueInfo: QueueInfo) => {
    if (queueInfo) {
      const newWaitTime = queueInfo.rawAssignedEst - new Date().getTime();
      ChatState.estimatedWaitTime = newWaitTime > 0 ? newWaitTime : 0;
    } else {
      ChatState.estimatedWaitTime = undefined;
    }
  };

  // @ts-ignore no-unused-variable
  private _processQueueDisposition = (queueDisposition: QueueDisposition) => {
    const agentMessages = this.transcript.filter(message => message.authorType === 'User');
    const agentEndedEvents = this.transcript.filter(event => event.type === 'End');

    ChatState.agentIsAssigned =
      queueDisposition === 'assigned' ||
      (agentMessages.length > 0 && agentEndedEvents.length === 0) ||
      (agentMessages.length > 0 &&
        agentEndedEvents.length > 0 &&
        agentMessages[agentMessages.length - 1].timestamp >
          agentEndedEvents[agentEndedEvents.length - 1].timestamp);
  };

  // @ts-ignore no-unused-variable
  private _processConversation = (
    conversation: Conversation,
    sendNewMessageCallback: boolean = true,
  ): void => {
    // Transcript changed callback
    // NOTE: We do not check to see if a message has CHANGED; we only react if there is a NEW MESSAGE
    if (conversation.messages.length > this.transcript.length) {
      // TODO: This filtering logic is needed as long as CB sends us duplicate messages for rich interactions
      // TODO: Remove when we use type TEXT for all messages
      const uniqueItems = this._removeItemsWithDuplicateIdsPrioritizingRichMessages(
        conversation.messages,
      );

      this.transcript = sortByTimestamp(uniqueItems);
      if (this.callbacks.onTranscriptChanged && sendNewMessageCallback) {
        this.callbacks.onTranscriptChanged(this.transcript);
      }
    }

    this._processQueueDisposition(conversation.queueDisposition);

    this._processQueueInfo(conversation.queueInfo);

    // Fire registration callback if user just became registered
    if (this.callbacks.onRegistration && conversation.registered && !ChatState.userIsRegistered) {
      this.callbacks.onRegistration();
    }

    ChatState.userIsRegistered = conversation.registered;
    ChatState.subscribed = conversation.subscribed;
  };
}

export default new QuiqChatClient();

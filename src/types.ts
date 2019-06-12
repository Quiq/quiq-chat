import { StorageMode } from './storage';

export interface ParsedUrl {
  hostname?: string;
  port?: string;
  protocol?: string;
  pathname?: string;
  rawUrl: string;
}

export interface Context {
  href?: string;
  intent?: string;
  data?: Object;
}

export interface QuiqChatState {
  contactPoint?: string;
  host?: ParsedUrl;
  configuration?: ChatMetadata;
  burned?: boolean;
  accessToken?: string;
  subscribed?: boolean;
  userIsRegistered?: boolean;
  agentIsAssigned?: boolean;
  trackingId?: string;
  connected?: boolean;
  reconnecting?: boolean;
  estimatedWaitTime?: number;
  chatIsVisible?: boolean;
  hasTakenMeaningfulAction?: boolean;
  customPersistedData?: { [key: string]: any };
  context?: Context;
  transcript?: Array<TranscriptItem>;
}

export enum EventType {
  JOIN = 'Join',
  LEAVE = 'Leave',
  REGISTER = 'Register',
  SEND_TRANSCRIPT = 'SendTranscript',
  END = 'End',
  SPAM = 'Spam',
  FAILED = 'Failed',
}

export enum ChatterboxMessageType {
  BURN_IT_DOWN = 'BurnItDown',
  CHAT_MESSAGE = 'ChatMessage',
  UNSUBSCRIBE = 'Unsubscribe',
  QUEUE_DISPOSITION = 'QueueDisposition',
  QUEUE_INFO = 'QueueInfo',
}

export enum AuthorType {
  CUSTOMER = 'Customer',
  USER = 'User',
  SYSTEM = 'System',
}

export enum ConversationMessageType {
  TEXT = 'Text',
  RICH = 'Rich',
  ATTACHMENT = 'Attachment',
  AGENT_TYPING = 'AgentTyping',
}

export enum MessageStatus {
  PENDING = 'pending',
  DELIVERED = 'delivered',
}

export interface IsomorphicFetchNetworkError {
  message: string;
  stack: string;
  status?: number; // We manually append this, it is not normally present on the object.
}

export interface Author {
  authorType: AuthorType;
  authorDisplayName?: string;
  authorProfilePicture?: string;
}

export interface EmailTranscriptPayload {
  email: string;
  originUrl: string;
  timezone?: string;
}

export interface PersistentData {
  accessToken?: string;
  chatContainerVisible?: boolean;
  subscribed?: boolean;
  hasTakenMeaningfulAction?: boolean;

  [key: string]: any;
}

export interface MessageFailureData {
  reason: string;
}

export interface QuiqChatCallbacks {
  onRegistration?: (registrationData?: { [field: string]: any }) => void;
  onAgentTyping?: (typing: boolean, author: Author) => void;
  onMessageSendFailure?: (messageId: string, data: MessageFailureData) => void;
  onError?: (error?: ApiError) => void;
  onErrorResolution?: () => void;
  onNewSession?: () => void;
  onPersistentDataChange?: (data: PersistentData) => void;
  sentryMetadata?: () => Object;
}

export interface QuiqChatClientType {
  host: string;
  contactPoint: string;
  callbacks: QuiqChatCallbacks;
  messages: Array<TextMessage>;
  onNewMessages: (callback: (messages: Array<TextMessage>) => void) => QuiqChatClientType;
  onAgentTyping: (callback: (typing: boolean) => void) => QuiqChatClientType;
  onAgentAssigned: (callback: (typing: boolean) => void) => QuiqChatClientType;
  onEstimatedWaitTimeChanged: (
    callback: (estimatedWaitTime?: number) => void,
  ) => QuiqChatClientType;
  onError: (callback: (error?: ApiError) => void) => QuiqChatClientType;
  onErrorResolved: (callback: () => void) => QuiqChatClientType;
  onConnectionStatusChange: (callback: (connected: boolean) => void) => QuiqChatClientType;
  onBurn: (callback: () => void) => QuiqChatClientType;
  stop: () => void;
  sendTextMessage: (text: string) => void;
  updateMessagePreview: (text: string, typing: boolean) => void;
  sendRegistration: (fields: { [fieldName: string]: string }, formVersionId?: string) => void;
  checkForAgents: () => Promise<{ available: boolean }>;
  isChatVisible: () => boolean;
  hasTakenMeaningfulAction: () => boolean;
}

export interface Conversation {
  id: string;
  subscribed: boolean;
  registered: boolean;
  queueDisposition: QueueDisposition;
  queueInfo: any;
  messages: Array<TranscriptItem>;
}

export type TranscriptItem = Event | ConversationMessage;

export interface BaseTranscriptItem {
  id: string;
  timestamp: number;
}

export interface BurnItDownResponse {
  code: 466;
  before?: number;
  force?: boolean;
}

export interface UploadDirective {
  uploadId: string;
  directive: {
    url: string;
    formEntries: Array<{ name: string; value: string }>;
  };
}

export enum QueueDisposition {
  ASSIGNED = 'assigned',
  WAITING = 'waiting',
  UNKNOWN = 'unknown',
}

export interface QueueInfo {
  rawAssignedEst: number;
}

// NOTE: quiq-chat should be able to be agnostic to what a rich interaction consists of.
export type RichInteraction = { [key: string]: any };

// NOTE: quiq-chat should be able to be agnostic to what a rich interaction consists of.
export type QuiqReply = { [key: string]: any };

export type ChatterboxMessage =
  | ChatMessage
  | UnsubscribeMessage
  | BurnItDownMessage
  | QueueDispositionMessage
  | QueueInfoMessage;

export interface ChatterboxBaseMessage {
  tenantId: string;
}

export interface ChatMessage extends ChatterboxBaseMessage {
  messageType: ChatterboxMessageType.CHAT_MESSAGE;
  data: Event | ConversationMessage | AgentTypingMessage;
}

export interface UnsubscribeMessage extends ChatterboxBaseMessage {
  messageType: ChatterboxMessageType.UNSUBSCRIBE;
}

export interface BurnItDownMessage extends ChatterboxBaseMessage {
  messageType: ChatterboxMessageType.BURN_IT_DOWN;
  data: {
    before?: number;
    code: 466;
    force?: boolean;
  };
}

export interface QueueDispositionMessage extends ChatterboxBaseMessage {
  messageType: ChatterboxMessageType.QUEUE_DISPOSITION;
  data: QueueDisposition;
}

export interface QueueInfoMessage extends ChatterboxBaseMessage {
  messageType: ChatterboxMessageType.QUEUE_INFO;
  data: QueueInfo;
}

export interface AgentTypingMessage extends Author {
  type: ConversationMessageType.AGENT_TYPING;
  typing: boolean;
}

export interface TextMessage extends BaseTranscriptItem, Author {
  type: ConversationMessageType.TEXT;
  text: string;
  links: Array<Object>;
}

export interface RichMessage extends BaseTranscriptItem, Author {
  type: ConversationMessageType.RICH;
  richInteraction: RichInteraction;
  quiqReply: QuiqReply;
}

export interface AttachmentMessage extends BaseTranscriptItem, Author {
  type: ConversationMessageType.ATTACHMENT;
  url: string;
  contentType: string;
  status?: MessageStatus;
}

export type ConversationMessage = TextMessage | AttachmentMessage | RichMessage;

export interface BaseEvent extends BaseTranscriptItem {
  authorType?: AuthorType;
  type: EventType;
  id: string;
}

export interface MessageFailedEvent extends BaseEvent {
  type: EventType.FAILED;
  errorCode: number;
}

export interface EndEvent extends BaseEvent {
  type: EventType.END;
}

export interface JoinEvent extends BaseEvent {
  type: EventType.JOIN;
}

export interface LeaveEvent extends BaseEvent {
  type: EventType.LEAVE;
}

export interface SpamEvent extends BaseEvent {
  type: EventType.SPAM;
}

export interface SendTranscriptEvent extends BaseEvent {
  type: EventType.SEND_TRANSCRIPT;
}

export interface RegisterEvent extends BaseEvent {
  type: EventType.REGISTER;
}

export type Event =
  | MessageFailedEvent
  | EndEvent
  | LeaveEvent
  | SpamEvent
  | SendTranscriptEvent
  | RegisterEvent
  | JoinEvent;

export interface ChatMetadata {
  configs: {
    CHAT_STORAGE_MODE?: StorageMode;
    [configName: string]:
      | {
          enabled?: boolean;
          [property: string]: any;
        }
      | StorageMode
      | undefined;
  };
  registrationForm?: {
    headerText: string;
    fields: Array<{
      type: 'text' | 'number' | 'email' | 'tel' | 'textarea' | 'select';
      label: string;
      id: string;
      required?: boolean;
      rows?: number;
      isInitialMessage?: boolean;
      additionalProperties: {
        options?: string;
        rows?: number;
        isInitialMessage?: boolean;
      };
    }>;
  };
  registrationFormVersionId?: string;
}

export type ReplyResponse = {
  text: string;
  postbackData?: Object;
  replyDirectives?: Object;
};

export interface WebsocketCallbacks {
  onConnectionLoss?: () => void;
  onConnectionEstablish?: () => Promise<void> | undefined;
  onMessage?: (message: ChatterboxMessage) => void;
  onClose?: () => void;
  onFatalError?: () => void;
}

export type BrowserNames =
  | 'Amaya'
  | 'Android Browser'
  | 'Arora'
  | 'Avant'
  | 'Baidu'
  | 'Blazer'
  | 'Bolt'
  | 'Camino'
  | 'Chimera'
  | 'Chrome'
  | 'Chromium'
  | 'Comodo Dragon'
  | 'Conkeror'
  | 'Dillo'
  | 'Dolphin'
  | 'Doris'
  | 'Edge'
  | 'Epiphany'
  | 'Fennec'
  | 'Firebird'
  | 'Firefox'
  | 'Flock'
  | 'GoBrowser'
  | 'iCab'
  | 'ICE Browser'
  | 'IceApe'
  | 'IceCat'
  | 'IceDragon'
  | 'Iceweasel'
  | 'IE'
  | 'IE Mobile'
  | 'Iron'
  | 'Jasmine'
  | 'K-Meleon'
  | 'Konqueror'
  | 'Kindle'
  | 'Links'
  | 'Lunascape'
  | 'Lynx'
  | 'Maemo'
  | 'Maxthon'
  | 'Midori'
  | 'Minimo'
  | 'MIUI Browser'
  | 'Safari'
  | 'Safari Mobile'
  | 'Mosaic'
  | 'Mozilla'
  | 'Netfront'
  | 'Netscape'
  | 'NetSurf'
  | 'Nokia'
  | 'OmniWeb'
  | 'Opera'
  | 'Opera Mini'
  | 'Opera Mobi'
  | 'Opera Tablet'
  | 'PhantomJS'
  | 'Phoenix'
  | 'Polaris'
  | 'QQBrowser'
  | 'RockMelt'
  | 'Silk'
  | 'Skyfire'
  | 'SeaMonkey'
  | 'SlimBrowser'
  | 'Swiftfox'
  | 'Tizen'
  | 'UCBrowser'
  | 'Vivaldi'
  | 'w3m'
  | 'WeChat'
  | 'Yandex'
  | null;

export type OSNames =
  | 'AIX'
  | 'Amiga OS'
  | 'Android'
  | 'Arch'
  | 'Bada'
  | 'BeOS'
  | 'BlackBerry'
  | 'CentOS'
  | 'Chromium OS'
  | 'Contiki'
  | 'Fedora'
  | 'Firefox OS'
  | 'FreeBSD'
  | 'Debian'
  | 'DragonFly'
  | 'Gentoo'
  | 'GNU'
  | 'Haiku'
  | 'Hurd'
  | 'iOS'
  | 'Joli'
  | 'Linpus'
  | 'Linux'
  | 'Mac OS'
  | 'Mageia'
  | 'Mandriva'
  | 'MeeGo'
  | 'Minix'
  | 'Mint'
  | 'Morph OS'
  | 'NetBSD'
  | 'Nintendo'
  | 'OpenBSD'
  | 'OpenVMS'
  | 'OS/2'
  | 'Palm'
  | 'PCLinuxOS'
  | 'Plan9'
  | 'Playstation'
  | 'QNX'
  | 'RedHat'
  | 'RIM Tablet OS'
  | 'RISC OS'
  | 'Sailfish'
  | 'Series40'
  | 'Slackware'
  | 'Solaris'
  | 'SUSE'
  | 'Symbian'
  | 'Tizen'
  | 'Ubuntu'
  | 'UNIX'
  | 'VectorLinux'
  | 'WebOS'
  | 'Windows'
  | 'Windows Phone'
  | 'Windows Mobile'
  | 'Zenwalk'
  | null;

export interface FetchRequestOptions {
  headers: {
    'X-Quiq-Line'?: string;
    'X-Quiq-Client-Id'?: string;
    'X-Quiq-Client-Version'?: string;
    'x-centricient-correlation-id'?: string;
    'X-Quiq-Access-Token'?: string;
    Accept?: string;
    'Content-Type'?: string;
  };
  method: string;
  mode: string;
  correlationId: string;
}

export interface ApiError {
  code?: number;
  message?: string;
  status?: number;
}

export interface QuiqJwt {
  sub: string;
}

export type Timeout = number;
export type Interval = number;

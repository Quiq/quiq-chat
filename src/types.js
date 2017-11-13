// @flow

export type QuiqChatSettings = {
  HOST: string,
  CONTACT_POINT: string,
  BURNED?: boolean,
};

export type EventType = 'Join' | 'Leave' | 'Register' | 'SendTranscript' | 'End' | 'Spam';
export type AuthorType = 'Customer' | 'User' | 'System';
export type TextMessageType = 'Text';
export type AttachmentMessageType = 'Attachment';
export type WebsocketMessageType = 'ChatMessage' | 'BurnItDown';
export type UserEventTypes = 'Join' | 'Leave';
export type MessageStatusType = 'pending' | 'delivered';

export type IsomorphicFetchNetworkError = {
  message: string,
  stack: string,
  status?: number, // We manually append this, it is not normally present on the object.
};

export type AgentTypingMessage = {
  type: 'AgentTyping',
  typing: boolean,
};

export type QueueDispositionMessage = {
  type: 'queueDisposition',
  queueDisposition: string,
};

export type BurnItDownPayload = {
  before?: number,
  code: 466,
  force?: boolean,
};

export type EmailTranscriptPayload = {
  email: string,
  originUrl: string,
  timezone?: string,
};

export type QuiqChatCallbacks = {
  onNewMessages?: (messages: Array<ConversationMessage>) => void,
  onAgentTyping?: (typing: boolean) => void,
  onMessageSendFailure?: (messageId: string) => void,
  onError?: (error: ?ApiError) => void,
  onRetryableError?: (error: ?ApiError) => void,
  onErrorResolved?: () => void,
  onConnectionStatusChange?: (connected: boolean) => void,
  onRegistration?: () => void,
  onAgentConnected?: (connected: boolean) => void,
  onSendTranscript?: (event: Event) => void,
  onNewSession?: () => void,
  onClientInactiveTimeout?: () => void,
  onAgentEndedConversation?: (type: Event) => void,
  onChatMarkedAsSpam?: () => void,
  sentryMetadata?: () => Object,
};

export type QuiqChatClientType = {
  host: string,
  contactPoint: string,
  callbacks: QuiqChatCallbacks,
  messages: Array<TextMessage>,
  onNewMessages: (callback: (messages: Array<TextMessage>) => void) => QuiqChatClientType,
  onAgentTyping: (callback: (typing: boolean) => void) => QuiqChatClientType,
  onError: (callback: (error: ?ApiError) => void) => QuiqChatClientType,
  onErrorResolved: (callback: () => void) => QuiqChatClientType,
  onConnectionStatusChange: (callback: (connected: boolean) => void) => QuiqChatClientType,
  onBurn: (callback: () => void) => QuiqChatClientType,
  stop: () => void,
  joinChat: () => void,
  leaveChat: () => void,
  sendTextMessage: (text: string) => void,
  updateMessagePreview: (text: string, typing: boolean) => void,
  sendRegistration: (fields: {[string]: string}) => void,
  checkForAgents: () => Promise<{available: boolean}>,
  isChatVisible: () => boolean,
  hasTakenMeaningfulAction: () => boolean,
};

export type Conversation = {
  id: string,
  subscribed: boolean,
  registered: boolean,
  messages: Array<TextMessage | Event>,
};
export type ConversationResult = {
  events: Array<Event>,
  messages: Array<ConversationMessage>,
  isSubscribed: boolean,
  isRegistered: boolean,
};
export type AtmosphereTransportType =
  | 'websocket'
  | 'long-polling'
  | 'jsonp'
  | 'sse'
  | 'streaming'
  | 'polling';

export type AtmosphereRequest = {
  url: string,
  contentType: string,
  logLevel: string,
  transport: AtmosphereTransportType,
  fallbackTransport: AtmosphereTransportType,
  trackMessageLength: boolean,
  maxReconnectOnClose: number,
  reconnectInterval: number,
  uuid?: string,
  onOpen?: (response: AtmosphereResponse) => void,
  onReopen?: () => void,
  onReconnect?: (req: AtmosphereRequest, res: AtmosphereResponse) => void,
  onTransportFailure?: (errorMsg: string, request: AtmosphereRequest) => void,
  onMessage?: (response: AtmosphereResponse) => void,
  onError?: (response: AtmosphereResponse) => void,
  onClientTimeout?: (req: AtmosphereRequest) => void,
  onClose?: (response: AtmosphereResponse) => void,
};

export type AtmosphereResponse = {
  request: AtmosphereRequest,
  responseBody: Object,
  status: number,
  error?: string,
  state: string,
};

export type BurnItDownResponse = {
  code: 466,
  before?: number,
  force?: boolean,
};

export type AtmosphereConnectionBuilder = {
  socketUrl: string,
  callbacks: WebsocketCallbacks,
};

export type AtmosphereConnection = {
  pingTimeout?: number,
  upgradeTimeout?: number,
  pendingPing?: boolean,
  originalTransport: AtmosphereTransportType,
  originalFallbackTransport: AtmosphereTransportType,
  request: {
    url: string,
    contentType: string,
    logLevel: string,
    transport: AtmosphereTransportType,
    fallbackTransport: AtmosphereTransportType,
    trackMessageLength: boolean,
    maxReconnectOnClose: number,
    reconnectInterval: number,
    uuid?: string,
    onOpen: (response: AtmosphereResponse) => void,
    onClose: (response: AtmosphereResponse) => void,
    onReopen: () => void,
    onReconnect: (req: AtmosphereRequest, res: AtmosphereResponse) => void,
    onMessage: (response: AtmosphereResponse) => void,
    onTransportFailure: (errorMsg: string, req: AtmosphereRequest) => void,
    onError: (response: AtmosphereResponse) => void,
    onClientTimeout: (req: AtmosphereRequest) => void,
  },
};

export type UploadDirective = {
  uploadId: string,
  directive: {
    url: string,
    formEntries: Array<{name: string, value: string}>,
  },
};

export type ConversationElement = {
  tenantId: string,
  messageType: 'ChatMessage',
  data: Event | ConversationMessage | AgentTypingMessage | QueueDispositionMessage,
};

export type ConversationMessage = TextMessage | AttachmentMessage;

export type TextMessage = {
  authorType: AuthorType,
  text: string,
  id: string,
  timestamp: number,
  type: TextMessageType,
};

export type AttachmentMessage = {
  id: string,
  timestamp: number,
  type: AttachmentMessageType,
  authorType: AuthorType,
  url: string,
  contentType: string,
  status?: MessageStatusType,
};

export type Event = {
  authorType?: AuthorType,
  id: string,
  timestamp: number,
  type: EventType,
};

export type BurnItDownMessage = {
  tenantId: string,
  messageType: 'BurnItDown',
  data: BurnItDownPayload,
};

export type ChatMetadata = {
  configs: {
    [string]: {
      enabled: boolean,
    },
  },
  registrationForm?: {
    headerText: string,
    fields: Array<{
      type: 'text' | 'number' | 'email' | 'tel' | 'textarea',
      label: string,
      id: string,
      required?: boolean,
      rows?: number,
      isInitialMessage?: boolean,
    }>,
  },
};

export type WebsocketCallbacks = {
  onConnectionLoss?: () => void,
  onConnectionEstablish?: () => ?Promise<void>,
  onMessage?: (message: ConversationElement | BurnItDownMessage) => void,
  onTransportFailure?: (errorMsg: string, req: AtmosphereRequest) => void,
  onClose?: () => void,
  onFatalError?: () => void,
};

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

export type ApiError = {
  code?: number,
  message?: string,
  status?: number,
};

export type Timeout = number;
export type Interval = number;

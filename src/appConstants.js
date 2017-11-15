// @flow

export const MessageTypes = {
  // eslint-disable-line import/prefer-default-export
  TEXT: 'Text',
  ATTACHMENT: 'Attachment',
  FAILED: 'Failed',
  CHAT_MESSAGE: 'ChatMessage',
  JOIN: 'Join',
  LEAVE: 'Leave',
  REGISTER: 'Register',
  SEND_TRANSCRIPT: 'SendTranscript',
  BURN_IT_DOWN: 'BurnItDown',
  AGENT_TYPING: 'AgentTyping',
  UNSUBSCRIBE: 'Unsubscribe',
  ENDED: 'End',
  SPAM: 'Spam',
  QUEUE_DISPOSITION: 'QueueDisposition',
  ESTIMATED_WAIT_TIME: 'QueueInfo',
};

export const SupportedWebchatUrls = [
  'goquiq.com/app/webchat',
  'quiq.sh/app/webchat',
  'centricient.com/app/webchat',
  'centricient.corp/app/webchat',
  'quiq.dev:7000/app/webchat',
  'centricient.dev:7000/app/webchat',
  'quiq.dev:41014/app/webchat',
  'centricient.dev:41014/app/webchat',
];

export const MAX_SOCKET_CONNECTION_ATTEMPTS = 20;

export const noAgentsAvailableClass = 'noAgentsAvailable';

// @flow

import type {CookieDef} from 'types';

export const MessageTypes = {
  // eslint-disable-line import/prefer-default-export
  TEXT: 'Text',
  CHAT_MESSAGE: 'ChatMessage',
  JOIN: 'Join',
  LEAVE: 'Leave',
  REGISTER: 'Register',
  BURN_IT_DOWN: 'BurnItDown',
  AGENT_TYPING: 'AgentTyping',
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

export const quiqChatVisible: CookieDef = {
  id: 'quiq-chat-visible',
  expiration: 1, // 1 day
};

export const noAgentsAvailableClass = 'noAgentsAvailable';

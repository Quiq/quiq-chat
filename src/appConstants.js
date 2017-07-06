// @flow

import type {CookieDef} from 'types';

export const MessageTypes = {
  // eslint-disable-line import/prefer-default-export
  TEXT: 'Text',
  CHAT_MESSAGE: 'ChatMessage',
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

export const quiqChatContinuationCookie: CookieDef = {
  id: 'quiq-chat-continuation',
  expiration: 1, // 1 day
};

export const noAgentsAvailableClass = 'noAgentsAvailable';

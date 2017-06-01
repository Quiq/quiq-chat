// @flow

export type QuiqChatSettings = {
  HOST: string,
  CONTACT_POINT: string,
};

export type EventType = 'Text' | 'Join' | 'Leave';
export type AuthorType = 'Customer' | 'Agent';
export type MessageType = 'Text' | 'ChatMessage';

export type Message = {
  authorType: AuthorType,
  text: string,
  id: string,
  timestamp: number,
  type: EventType,
};

export type Conversation = {
  id: string,
  messages: Array<Message>,
};

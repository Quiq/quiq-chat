// @flow

import * as API from './apiCalls';
import {setGlobals, checkRequiredSettings} from './globals';
import {connectSocket, disconnectSocket} from './websockets';
import type {
  AtmosphereMessage,
  Message,
  ApiError,
  QuiqChatCallbacks,
  UserEventTypes,
} from './types';
import {MessageTypes, quiqChatContinuationCookie} from './appConstants';
import {set, get} from 'js-cookie';
import {differenceBy, last} from 'lodash';

const handleWebsocketMessage = Symbol('handleWebsocketMessage');
const handleConnectionLoss = Symbol('handleConnectionLoss');
const handleConnectionEstablish = Symbol('handleConnectionEstablish');
const handleRetryableError = Symbol('handleRetryableError');

const getConversationMessages = async () => {
  const conversation = await API.fetchConversation();
  return conversation.messages.filter(
    m =>
      m.type === MessageTypes.TEXT &&
      !m.text.includes('Quiq Welcome Form Customer Submission').trim(),
  );
};

class QuiqChatClient {
  constructor(host: string, contactPoint: string) {
    this.host = host;
    this.contactPoint = contactPoint;
    this.callbacks = {};
    this.messages = [];

    setGlobals({
      HOST: this.host,
      CONTACT_POINT: this.contactPoint,
    });
  }

  /*** Fluent client builder functions: these all return the client object ***/

  onNewMessages = (callback: (messages: Array<Message>) => any): QuiqChatClient => {
    this.callbacks['onNewMessages'] = callback;
    return this;
  };

  onAgentTyping = (callback: (typing: boolean) => any): QuiqChatClient => {
    this.callbacks['onAgentTyping'] = callback;
    return this;
  };

  onError = (callback: (error: ?ApiError) => any): QuiqChatClient => {
    this.callbacks['onError'] = callback;
    return this;
  };

  onConnectionStatusChange = (callback: (connected: boolean) => any): QuiqChatClient => {
    this.callbacks['onConnectionStatusChange'] = callback;
    return this;
  };

  start = async (): QuiqChatClient => {
    checkRequiredSettings();

    try {
      // Order Matters here.  Ensure we succesfully complete this fetchConversation request before connecting to
      // the websocket below!
      this.messages = await getConversationMessages();

      // Fire onNewMessages callback with initial Messages
      (this.callbacks['onNewMessages'] || Function)(this.messages);

      // Set cookie
      set(quiqChatContinuationCookie.id, 'true', {
        expires: quiqChatContinuationCookie.expiration,
      });

      // Establish websocket connection
      disconnectSocket(); // Ensure we only have one websocket connection open
      const wsInfo: {url: string} = await API.fetchWebsocketInfo();
      connectSocket({
        socketUrl: wsInfo.url,
        callbacks: {
          onConnectionLoss: this[handleConnectionLoss],
          onConnectionEstablish: this[handleConnectionEstablish],
          onMessage: this[handleWebsocketMessage],
        },
      });

      (this.callbacks['onError'] || Function)(err);
      (this.callbacks['onConnectionStatusChange'] || Function)(true);
    } catch (err) {
      console.error(err);
      disconnectSocket();
      this[handleRetryableError](err, this.start);
    }
  };

  stop = () => {
    disconnectSocket();
  };

  getMessages = async (cahce = true): Array<Message> => {
    if (cache) return this.messages;

    this.messages = await getConversationMessages();
    return this.messages;
  };

  /*** API wrappers: these return Promises around the API response ***/

  joinChat = () => {
    return API.joinChat();
  };

  leaveChat = () => {
    return API.leaveChat();
  };

  sendMessage = (text: string) => {
    return API.addMessage(text);
  };

  updateMessagePreview = (text: string, typing: boolean) => {
    return API.updateMessagePreview(text, typing);
  };

  sendRegistration = (fields: {[string]: string}) => {
    return API.sendRegistration(fields);
  };

  checkForAgents = () => {
    return API.checkForAgents();
  };

  hasActiveChat = (): boolean => {
    // quiq-chat-continuation is a cookie to tell if the user has already initiated a chat
    return get(quiqChatContinuationCookie.id);
  };

  getLastUserEvent = async (): UserEventTypes | null => {
    const conversation = await API.fetchConversation();
    if (conversation && conversation.messages.length) {
      const lastStatusMessage = last(
        conversation.messages.filter(m => m.type === 'Join' || m.type === 'Leave'),
      );
      if (lastStatusMessage) return lastStatusMessage.type;
    }

    return null;
  };

  /*** Private Members ***/

  [handleWebsocketMessage] = (message: AtmosphereMessage) => {
    if (message.messageType === MessageTypes.CHAT_MESSAGE) {
      switch (message.data.type) {
        case 'Text':
          if (!this.messages.some(m => m.id === message.id)) {
            this.messages.push(message.data);
          }
          (this.callbacks['onNewMessages'] || Function)([message.data]);
          break;
        case 'AgentTyping':
          (this.callbacks['onAgentTyping'] || Function)(message.data.typing);
          break;
      }
    }
  };

  [handleRetryableError] = (err?: ApiError, retry?: () => ?Promise<*>) => {
    if (err && err.status && err.status > 404) {
      if (retry) {
        setTimeout(retry, 5000);
      }
    } else {
      (this.callbacks['onError'] || Function)(err);
    }
  };

  [handleConnectionLoss] = () => {
    (this.callbacks['onConnectionStatusChange'] || Function)(false);
  };

  [handleConnectionEstablish] = () => {
    const messages = getConversationMessages();

    // If messages came in while disconnected, push to callback
    const newMessages = differenceBy(this.messages, messages, 'id');

    if (newMessages.length) (this.callbacks['onNewMessages'] || Function)(newMessages);

    (this.callbacks['onConnectionStatusChange'] || Function)(true);
  };
}

export default QuiqChatClient;

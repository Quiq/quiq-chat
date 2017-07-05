// @flow
import * as API from './apiCalls';
import {setGlobals, checkRequiredSettings} from './globals';
import {connectSocket, disconnectSocket} from './websockets';
import type {AtmosphereMessage, Message, ApiError, UserEventTypes} from './types';
import {MessageTypes, quiqChatContinuationCookie} from './appConstants';
import {set, get} from 'js-cookie';
import {differenceBy, last} from 'lodash';

const getConversationMessages = async () => {
  const conversation = await API.fetchConversation();
  return conversation.messages.filter(
    m =>
      m.type === MessageTypes.TEXT &&
      !m.text.trim().includes('Quiq Welcome Form Customer Submission'),
  );
};

type QuiqChatCallbacks = {
  onNewMessages?: (messages: Array<Message>) => void,
  onAgentTyping?: (typing: boolean) => void,
  onError?: (error: ?ApiError) => void,
  onErrorResolved?: () => void,
  onConnectionStatusChange?: (connected: boolean) => void,
};

class QuiqChatClient {
  host: string;
  contactPoint: string;
  callbacks: QuiqChatCallbacks;
  messages: Array<Message>;

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

  onNewMessages = (callback: (messages: Array<Message>) => void): QuiqChatClient => {
    this.callbacks.onNewMessages = callback;
    return this;
  };

  onAgentTyping = (callback: (typing: boolean) => void): QuiqChatClient => {
    this.callbacks.onAgentTyping = callback;
    return this;
  };

  onError = (callback: (error: ?ApiError) => void): QuiqChatClient => {
    this.callbacks.onError = callback;
    return this;
  };

  onErrorResolved = (callback: () => void): QuiqChatClient => {
    this.callbacks.onErrorResolved = callback;
    return this;
  };

  onConnectionStatusChange = (callback: (connected: boolean) => void): QuiqChatClient => {
    this.callbacks.onConnectionStatusChange = callback;
    return this;
  };

  start = async (): Promise<?QuiqChatClient> => {
    checkRequiredSettings();

    try {
      // Order Matters here.  Ensure we succesfully complete this fetchConversation request before connecting to
      // the websocket below!
      this.messages = await getConversationMessages();

      // Fire onNewMessages callback with initial Messages
      if (this.callbacks.onNewMessages) {
        this.callbacks.onNewMessages(this.messages);
      }

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
          onConnectionLoss: this._handleConnectionLoss,
          onConnectionEstablish: this._handleConnectionEstablish,
          onMessage: this._handleWebsocketMessage,
        },
      });

      // Todo: Resolve all errors on connection

      if (this.callbacks.onConnectionStatusChange) {
        this.callbacks.onConnectionStatusChange(true);
      }
      if (this.callbacks.onErrorResolved) {
        this.callbacks.onErrorResolved();
      }
    } catch (err) {
      console.error(err);
      disconnectSocket();
      this._handleRetryableError(err, this.start);
    }
  };

  stop = () => {
    disconnectSocket();
  };

  getMessages = async (cache: boolean = true): Promise<Array<Message>> => {
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

  getLastUserEvent = async (): Promise<UserEventTypes | null> => {
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

  _handleWebsocketMessage = (message: AtmosphereMessage) => {
    if (message.messageType === MessageTypes.CHAT_MESSAGE) {
      switch (message.data.type) {
        case 'Text':
          if (!this.messages.some(m => m.id === message.data.id)) {
            this.messages.push(message.data);
            if (this.callbacks.onNewMessages) {
              this.callbacks.onNewMessages([message.data]);
            }
          }
          break;
        case 'AgentTyping':
          if (this.callbacks.onAgentTyping) {
            this.callbacks.onAgentTyping(message.data.typing);
          }
          break;
      }
    }
  };

  _handleRetryableError = (err?: ApiError, retry?: () => ?Promise<*>) => {
    if (err && err.status && err.status > 404) {
      if (retry) {
        setTimeout(retry, 5000);
      }
    } else {
      if (this.callbacks.onError) {
        this.callbacks.onError(err);
      }
    }
  };

  _handleConnectionLoss = () => {
    if (this.callbacks.onConnectionStatusChange) {
      this.callbacks.onConnectionStatusChange(false);
    }
  };

  _handleConnectionEstablish = () => {
    const messages = getConversationMessages();

    // If messages came in while disconnected, push to callback
    const newMessages = differenceBy(this.messages, messages, 'id');

    if (newMessages.length && this.callbacks.onNewMessages) {
      this.callbacks.onNewMessages(newMessages);
    }

    if (this.callbacks.onConnectionStatusChange) {
      this.callbacks.onConnectionStatusChange(true);
    }
  };
}

export default QuiqChatClient;

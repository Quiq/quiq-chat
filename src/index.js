// @flow
import * as API from './apiCalls';
import {setGlobals, isActive} from './globals';
import {connectSocket, disconnectSocket} from './websockets';
import QuiqChatClient from './QuiqChatClient';

import type {WebsocketCallbacks} from 'types';

export const init = async (settings: {HOST: string, CONTACT_POINT?: string}) => {
  if (isActive()) return;
  await API.login(settings.HOST);

  const defaults = {
    CONTACT_POINT: 'default',
    ACTIVE: true,
  };
  setGlobals(Object.assign({}, defaults, settings));
};

export const subscribe = async (callbacks: WebsocketCallbacks) => {
  disconnectSocket(); // Ensure we only have one websocket connection open
  const wsInfo: {url: string} = await API.fetchWebsocketInfo();
  connectSocket({socketUrl: wsInfo.url, callbacks});
};

export const unsubscribe = () => disconnectSocket();

export const joinChat = () => API.joinChat();

export const leaveChat = () => API.leaveChat();

export const addMessage = (text: string) => API.addMessage(text);

export const fetchConversation = () => API.fetchConversation();

export const updateMessagePreview = (text: string, typing: boolean) =>
  API.updateMessagePreview(text, typing);

export const checkForAgents = () => API.checkForAgents();

export const sendRegistration = (fields: {[string]: string}) => API.sendRegistration(fields);

export default QuiqChatClient;

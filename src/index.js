// @flow
import * as API from './apiCalls';
import {setGlobals, checkRequiredSettings} from './globals';
import {connectSocket, disconnectSocket} from './websockets';
import type {QuiqChatSettings, AtmosphereMessage, WebsocketCallbacks} from 'types';

export const init = (settings: {HOST: string, CONTACT_POINT?: string}) => {
  const defaults = {
    CONTACT_POINT: 'default',
  };

  const globals = Object.assign({}, defaults, settings);

  setGlobals(globals);
};

export const subscribe = async (callbacks: WebsocketCallbacks) => {
  checkRequiredSettings();
  disconnectSocket(); // Ensure we only have one websocket connection open
  const wsInfo: {url: string} = await API.fetchWebsocketInfo();
  connectSocket({socketUrl: wsInfo.url, callbacks});
};

export const unsubscribe = () => {
  // Don't check requiredSettings here.  We don't want to block the client from disconnecting.
  disconnectSocket();
};

export const joinChat = () => {
  checkRequiredSettings();
  return API.joinChat();
};

export const leaveChat = () => {
  checkRequiredSettings();
  return API.leaveChat();
};

export const addMessage = (text: string) => {
  checkRequiredSettings();
  return API.addMessage(text);
};

export const fetchConversation = () => {
  checkRequiredSettings();
  return API.fetchConversation();
};

export const updateMessagePreview = (text: string, typing: boolean) => {
  checkRequiredSettings();
  return API.updateMessagePreview(text, typing);
};

export const checkForAgents = () => {
  checkRequiredSettings();
  return API.checkForAgents();
};

export const sendRegistration = (fields: {[string]: string}) => {
  checkRequiredSettings();
  return API.sendRegistration(fields);
};

// @flow
import * as API from './apiCalls';
import {setGlobals, checkRequiredSettings} from './globals';
import {connectSocket} from './websockets';
import type {QuiqChatSettings, AtmosphereMessage} from 'types';

export const init = (settings: {HOST: string, CONTACT_POINT?: string}) => {
  const defaults = {
    CONTACT_POINT: 'default',
  };

  const globals = Object.assign({}, defaults, settings);

  setGlobals(globals);
};

type Callbacks = {
  onConnectionLoss: () => void,
  onConnectionEstablish: () => void,
  handleMessage: (message: AtmosphereMessage) => void,
};

export const subscribe = async (callbacks: Callbacks) => {
  checkRequiredSettings();
  const wsInfo: {url: string} = await API.fetchWebsocketInfo();
  connectSocket({socketUrl: wsInfo.url, options: callbacks});
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

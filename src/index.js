// @flow
import * as API from './apiCalls';
import {setGlobals, checkRequiredSettings} from './globals';
import type {QuiqChatSettings} from 'types';

export const init = (settings: QuiqChatSettings) => {
  setGlobals(settings);
};

// TODO: Subscribe method for websocket events

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

// fetchWebsocketInfo?

// ping?

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

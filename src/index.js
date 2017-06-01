// @flow
import * as API from './apiCalls';
import {setGlobals} from './globals';

export const init = (settings: QuiqChatSettings) => {
  setGlobals(settings);
};

// TODO: Subscribe method for websocket events

function checkRequiredSettings() {
  if (!quiqChatSettings || !quiqChatSettings.HOST || !quiqChatSettings.CONTACT_POINT) {
    throw new Error(
      `
      HOST and CONTACT_POINT must be configured to call Quiq Messaging.
      Did you forget to call init?
      `,
    );
  }
}

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

export const updateMessagePreview = () => {
  checkRequiredSettings();
  return API.updateMessagePreview();
};

export const checkForAgents = () => {
  checkRequiredSettings();
  return API.checkForAgents();
};

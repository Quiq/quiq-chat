// @flow

type QuiqChatSettings = {
  HOST: string,
  CONTACT_POINT: string,
};

let quiqChatSettings: QuiqChatSettings;

export const setGlobals = (globals: QuiqChatSettings) => {
  quiqChatSettings = globals;
};

export const getHost = () => quiqChatSettings.HOST;

export const getContactPoint = () => quiqChatSettings.CONTACT_POINT;

export const getPublicApiUrl = () => `${quiqChatSettings.HOST}/api/v1/messaging`;

export const getUrlForContactPoint = () =>
  `${quiqChatSettings.HOST}/api/v1/messaging/chat/${quiqChatSettings.CONTACT_POINT}`;

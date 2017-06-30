// @flow
import type {QuiqChatSettings} from 'types';

let quiqChatSettings: QuiqChatSettings;

const defaults = {
  CONTACT_POINT: 'default',
};

export const setGlobals = (globals: QuiqChatSettings) => {
  quiqChatSettings = Object.assign({}, defaults, globals);
};

export const checkRequiredSettings = () => {
  if (!quiqChatSettings || !quiqChatSettings.HOST || !quiqChatSettings.CONTACT_POINT) {
    throw new Error(
      `
      HOST and CONTACT_POINT must be configured to call Quiq Messaging.
      Did you forget to call init?
      `,
    );
  }
};

export const getHost = () => quiqChatSettings.HOST;

export const getContactPoint = () => quiqChatSettings.CONTACT_POINT;

export const getPublicApiUrl = () => `${quiqChatSettings.HOST}/api/v1/messaging`;

export const getUrlForContactPoint = () =>
  `${quiqChatSettings.HOST}/api/v1/messaging/chat/${quiqChatSettings.CONTACT_POINT}`;

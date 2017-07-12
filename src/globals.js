// @flow
import type {QuiqChatSettings} from 'types';

let burned = false;
export const getBurned = () => burned;
export const setBurned = () => {
  burned = true;
};

let quiqChatSettings: QuiqChatSettings;

const defaults = {
  CONTACT_POINT: 'default',
};

export const setGlobals = (globals: QuiqChatSettings) => {
  quiqChatSettings = Object.assign({}, defaults, globals);
};

export const checkRequiredSettings = () => {
  if (getBurned()) {
    throw new Error('Client in bad state. Aborting call.');
  }

  if (!quiqChatSettings || !quiqChatSettings.HOST || !quiqChatSettings.CONTACT_POINT) {
    throw new Error(
      `
      HOST and CONTACT_POINT must be configured to call Quiq Messaging.
      Did you forget to call init?
      `,
    );
  }
};

export const isActive = () => !!(quiqChatSettings && quiqChatSettings.ACTIVE);

export const getHost = () => quiqChatSettings.HOST;

export const getContactPoint = () => quiqChatSettings.CONTACT_POINT;

export const getPublicApiUrl = () => `${quiqChatSettings.HOST}/api/v1/messaging`;

export const getUrlForContactPoint = () =>
  `${quiqChatSettings.HOST}/api/v1/messaging/chat/${quiqChatSettings.CONTACT_POINT}`;

export const getSessionApiUrl = (host?: string) => `${host || quiqChatSettings.HOST}/session/web`;

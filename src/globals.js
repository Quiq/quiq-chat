// @flow
import Raven from 'raven-js';
import {getTenantFromHostname} from 'Utils/utils';
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

  // Update Raven if host is defined
  if (quiqChatSettings.HOST) {
    Raven.setTagsContext({
      tenant: getTenantFromHostname(quiqChatSettings.HOST),
    });
  }
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

export const getContactPoint = () => quiqChatSettings && quiqChatSettings.CONTACT_POINT;

const getHost = (cached: boolean) => {
  if (
    quiqChatSettings.HOST.includes('goquiq.com') ||
    quiqChatSettings.HOST.includes('quiq.dev') ||
    (quiqChatSettings.HOST.includes('quiq-api') && cached)
  ) {
    return quiqChatSettings.HOST;
  }

  try {
    const vanityName = quiqChatSettings.HOST.split('.')[0].split('https://')[1];
    return `https://${vanityName}.goquiq.com`;
  } catch (e) {
    return quiqChatSettings.HOST;
  }
};

export const getPublicApiUrl = (cached?: boolean = false) => `${getHost(cached)}/api/v1/messaging`;

export const getUrlForContactPoint = (cached?: boolean = false) =>
  `${getHost(cached)}/api/v1/messaging/chat/${quiqChatSettings.CONTACT_POINT}`;

export const getSessionApiUrl = (cached?: boolean = false) => `${getHost(cached)}/session/web`;

export const getGenerateUrl = (cached?: boolean = false) => {
  return `${getHost(cached)}/api/v1/token/generate`;
};

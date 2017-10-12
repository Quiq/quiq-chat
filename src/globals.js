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

export const getHost = () => quiqChatSettings && quiqChatSettings.HOST;

export const getContactPoint = () => quiqChatSettings && quiqChatSettings.CONTACT_POINT;

export const getPublicApiUrl = () =>
  quiqChatSettings && `${quiqChatSettings.HOST}/api/v1/messaging`;

export const getUrlForContactPoint = () =>
  quiqChatSettings &&
  `${quiqChatSettings.HOST}/api/v1/messaging/chat/${quiqChatSettings.CONTACT_POINT}`;

export const getSessionApiUrl = (host?: string) =>
  quiqChatSettings && `${host || quiqChatSettings.HOST}/session/web`;

export const getTokenApiUrl = (host?: string) =>
  quiqChatSettings && `${host || quiqChatSettings.HOST}/api/v1/token`;

export const getGenerateUrl = (host?: string) =>
  quiqChatSettings && `${getTokenApiUrl(host || quiqChatSettings.HOST)}/generate`;

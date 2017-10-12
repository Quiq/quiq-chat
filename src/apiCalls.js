// @flow
import {formatQueryParams, burnItDown} from './Utils/utils';
import {
  getUrlForContactPoint,
  getPublicApiUrl,
  getContactPoint,
  getSessionApiUrl,
  getGenerateUrl,
} from './globals';
import quiqFetch from './quiqFetch';
import {setAccessToken, getAccessToken, getTrackingId} from './storage';
import type {Conversation, ChatMetadata} from 'types';
import logger from './logging';
import Raven from 'raven-js';

const log = logger('apiCalls');

let _onNewSession: (newTrackingId: string) => any;

export const registerNewSessionCallback = (callback: (newTrackingId: string) => any) => {
  _onNewSession = callback;
};

export const keepAlive = () => quiqFetch(`${getUrlForContactPoint()}/keep-alive`, {method: 'POST'});

export const joinChat = () => quiqFetch(`${getUrlForContactPoint()}/join`, {method: 'POST'});

export const leaveChat = () => quiqFetch(`${getUrlForContactPoint()}/leave`, {method: 'POST'});

export const getChatConfiguration = (): Promise<ChatMetadata> =>
  quiqFetch(`${getUrlForContactPoint()}/configuration`, undefined, {responseType: 'JSON'});

export const addMessage = (text: string) =>
  quiqFetch(`${getUrlForContactPoint()}/send-message`, {
    method: 'POST',
    body: JSON.stringify({text}),
  });

export const fetchWebsocketInfo = (): Promise<{url: string, protocol: string}> =>
  quiqFetch(`${getUrlForContactPoint()}/socket-info`, undefined, {responseType: 'JSON'});

// Use socket-info as a ping since the ping endpoint isn't publicly exposed
export const ping = () => fetchWebsocketInfo();

export const fetchConversation = (): Promise<Conversation> =>
  quiqFetch(getUrlForContactPoint(), undefined, {responseType: 'JSON'});

export const updateMessagePreview = (text: string, typing: boolean) =>
  quiqFetch(`${getUrlForContactPoint()}/typing`, {
    method: 'POST',
    body: JSON.stringify({text, typing}),
  });

export const sendRegistration = (fields: {[string]: string}) =>
  quiqFetch(`${getUrlForContactPoint()}/register`, {
    method: 'POST',
    body: JSON.stringify({form: fields}),
  });

export const checkForAgents = (): Promise<{available: boolean}> =>
  quiqFetch(
    formatQueryParams(`${getPublicApiUrl()}/agents-available`, {
      platform: 'Chat',
      contactPoint: getContactPoint(),
    }),
    undefined,
    {responseType: 'JSON', cached: true},
  );

/**
 * Creates a new session and tracking ID
 * @param host - Host against which to call /generate
 * @param sessionChange - Indicates whether this is being called to replace old session. Results in newSession callback being fired.
 */
export const login = (host?: string) =>
  quiqFetch(
    getGenerateUrl(host),
    {
      method: 'POST',
    },
    {
      responseType: 'JSON',
    },
  ).then((res: {accessToken: string, tokenId: string}) => {
    setAccessToken(res.accessToken);

    if (getAccessToken() !== res.accessToken || getTrackingId() !== res.tokenId) {
      burnItDown();
      return Promise.reject();
    }

    if (_onNewSession) {
      _onNewSession(res.tokenId);
    }

    // Tell sentry about the new trackingId
    // This will let us track logs by trackingId
    Raven.setUserContext({
      id: getTrackingId(),
    });

    log.debug(`Login successful. trackingId: ${res.tokenId}`);
  });

export const logout = () => quiqFetch(getSessionApiUrl(), {method: 'DELETE'});

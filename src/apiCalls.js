// @flow
import {formatQueryParams} from './utils';
import {
  getUrlForContactPoint,
  getPublicApiUrl,
  getContactPoint,
  getSessionApiUrl,
  getGenerateUrl,
  GET_DEPRECATED_AUTH_URL,
} from './globals';
import quiqFetch from './quiqFetch';
import {setAccessToken, setTrackingId} from './storage';
import type {Conversation} from 'types';
import logger from './logging';

const log = logger('apiCalls');

let _onNewSession: (newTrackingId: string) => any;

export const registerNewSessionCallback = (callback: (newTrackingId: string) => any) => {
  _onNewSession = callback;
};

export const keepAlive = () => {
  return quiqFetch(`${getUrlForContactPoint()}/keep-alive`, {method: 'POST'});
};

let keepAliveInterval: number;

// eslint-disable-next-line no-unused-vars
const startHeartbeat = () => {
  clearInterval(keepAliveInterval);

  keepAlive();
  keepAliveInterval = setInterval(keepAlive, 60 * 1000);
};

// eslint-disable-next-line no-unused-vars
const stopHeartbeat = () => {
  clearInterval(keepAliveInterval);
};

export const joinChat = () => {
  return quiqFetch(`${getUrlForContactPoint()}/join`, {method: 'POST'});
};

export const leaveChat = () => {
  return quiqFetch(`${getUrlForContactPoint()}/leave`, {method: 'POST'});
};

export const addMessage = (text: string) => {
  return quiqFetch(`${getUrlForContactPoint()}/send-message`, {
    method: 'POST',
    body: JSON.stringify({text}),
  });
};

export const fetchWebsocketInfo = (): Promise<{url: string, protocol: string}> =>
  quiqFetch(`${getUrlForContactPoint()}/socket-info`, undefined, {responseType: 'JSON'});

// Use socket-info as a ping since the ping endpoint isn't publicly exposed
export const ping = () => fetchWebsocketInfo();

export const fetchConversation = (): Promise<Conversation> =>
  quiqFetch(getUrlForContactPoint(), undefined, {responseType: 'JSON'});

export const updateMessagePreview = (text: string, typing: boolean) => {
  return quiqFetch(`${getUrlForContactPoint()}/typing`, {
    method: 'POST',
    body: JSON.stringify({text, typing}),
  });
};

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
  ).then(res => {
    if (res) {
      if (res.accessToken) {
        setAccessToken(res.accessToken);
        setTrackingId(res.tokenId);

        log.debug(`Login successful. trackingId: ${res.tokenId}`);

        // Start calling the keepAlive endpoint
        // TODO: Check this back in when we're ready
        // startHeartbeat();
      }
      if (res.tokenId && _onNewSession) {
        _onNewSession(res.tokenId);
      }
    }
  });

export const DEPRECATED_AUTH_USER = (host?: string) =>
  quiqFetch(
    GET_DEPRECATED_AUTH_URL(host),
    {method: 'POST', credentials: 'include'},
    {responseType: 'JSON'},
  );

export const validateSession = () => quiqFetch(getSessionApiUrl());

export const logout = () => quiqFetch(getSessionApiUrl(), {method: 'DELETE'});
// TODO: Check this back in with the heartbeat stuff
// .then(stopHeartbeat);

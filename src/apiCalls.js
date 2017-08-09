// @flow
import {formatQueryParams} from './utils';
import {
  getUrlForContactPoint,
  getPublicApiUrl,
  getContactPoint,
  getSessionApiUrl,
  getTokenApiUrl,
} from './globals';
import quiqFetch from './quiqFetch';
import {setAccessToken} from './storage';
import type {Conversation} from 'types';

let _onNewSession: (newTrackingId: string) => any;

export const registerNewSessionCallback = (callback: (newTrackingId: string) => any) => {
  _onNewSession = callback;
};

export const joinChat = () => {
  quiqFetch(`${getUrlForContactPoint()}/join`, {method: 'POST'});
};

export const leaveChat = () => {
  quiqFetch(`${getUrlForContactPoint()}/leave`, {method: 'POST'});
};

export const addMessage = (text: string) => {
  quiqFetch(`${getUrlForContactPoint()}/send-message`, {
    method: 'POST',
    body: JSON.stringify({text}),
  });
};

export const fetchWebsocketInfo = (): Promise<{url: string}> =>
  quiqFetch(`${getUrlForContactPoint()}/socket-info`, undefined, {responseType: 'JSON'});

// Use socket-info as a ping since the ping endpoint isn't publicly exposed
export const ping = () => fetchWebsocketInfo();

export const fetchConversation = (): Promise<Conversation> =>
  quiqFetch(getUrlForContactPoint(), undefined, {responseType: 'JSON'});

export const updateMessagePreview = (text: string, typing: boolean) => {
  quiqFetch(`${getUrlForContactPoint()}/typing`, {
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
    {responseType: 'JSON'},
  );

/**
 * Creates a new session and tracking ID
 * @param host - Host against which to call /generate
 * @param sessionChange - Indicates whether this is being called to replace old session. Results in newSession callback being fired.
 */
export const login = (host?: string) =>
  quiqFetch(
    `${getTokenApiUrl(host)}/generate`,
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
      }
      if (res.tokenId && _onNewSession) {
        _onNewSession(res.tokenId);
      }
    }
  });

export const validateSession = () => quiqFetch(getSessionApiUrl());

export const logout = () => quiqFetch(getSessionApiUrl(), {method: 'DELETE'});

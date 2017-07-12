// @flow
import {formatQueryParams} from './utils';
import {getUrlForContactPoint, getPublicApiUrl, getContactPoint, getSessionApiUrl} from './globals';
import quiqFetch from './quiqFetch';
import type {Conversation} from 'types';

export const joinChat = () => {
  quiqFetch(`${getUrlForContactPoint()}/join`, {method: 'POST', credentials: 'include'});
};

export const leaveChat = () => {
  quiqFetch(`${getUrlForContactPoint()}/leave`, {method: 'POST', credentials: 'include'});
};

export const addMessage = (text: string) => {
  quiqFetch(`${getUrlForContactPoint()}/send-message`, {
    method: 'POST',
    credentials: 'include',
    body: JSON.stringify({text}),
  });
};

export const fetchWebsocketInfo = (): Promise<{url: string}> =>
  quiqFetch(
    `${getUrlForContactPoint()}/socket-info`,
    {credentials: 'include'},
    {responseType: 'JSON'},
  );

// Use socket-info as a ping since the ping endpoint isn't publicly exposed
export const ping = () => fetchWebsocketInfo();

export const fetchConversation = (): Promise<Conversation> =>
  quiqFetch(getUrlForContactPoint(), {credentials: 'include'}, {responseType: 'JSON'});

export const updateMessagePreview = (text: string, typing: boolean) => {
  quiqFetch(`${getUrlForContactPoint()}/typing`, {
    method: 'POST',
    credentials: 'include',
    body: JSON.stringify({text, typing}),
  });
};

export const sendRegistration = (fields: {[string]: string}) =>
  quiqFetch(`${getUrlForContactPoint()}/register`, {
    method: 'POST',
    credentials: 'include',
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

export const login = (host?: string) =>
  quiqFetch(`${getSessionApiUrl(host)}/generate`, {credentials: 'include', method: 'POST'});

export const validateSession = () => quiqFetch(getSessionApiUrl(), {credentials: 'include'});

export const logout = () =>
  quiqFetch(getSessionApiUrl(), {credentials: 'include', method: 'DELETE'});

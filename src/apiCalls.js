// @flow
import {formatQueryParams} from './utils';
import {getUrlForContactPoint, getPublicApiUrl, getContactPoint} from './globals';
import quiqFetch from './quiqFetch';
import type {Conversation} from 'types';

const parseResponse = (response: Response): Promise<*> => {
  if (response.status && response.status >= 300) {
    return response.json().then(res => Promise.reject(res)).catch(err => Promise.reject(err));
  }

  return response.json();
};

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
  quiqFetch(`${getUrlForContactPoint()}/socket-info`, {credentials: 'include'}, null).then(
    parseResponse,
  );

// Use socket-info as a ping since the ping endpoint isn't publicly exposed
export const ping = () => fetchWebsocketInfo();

export const fetchConversation = (): Promise<Conversation> =>
  quiqFetch(getUrlForContactPoint(), {credentials: 'include'}, null).then(parseResponse);

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
  ).then(parseResponse);

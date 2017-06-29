// @flow
import {formatQueryParams} from './utils';
import {getUrlForContactPoint, getPublicApiUrl, getContactPoint} from './globals';
import fetch from './fetch';
import type {Conversation} from 'types';

const parseResponse = (response: Response): Promise<*> => {
  if (response.status && response.status >= 300) {
    return response.json().then(res => Promise.reject(res)).catch(err => Promise.reject(err));
  }

  return response.json();
};

export const joinChat = () => {
  fetch(`${getUrlForContactPoint()}/join`, {method: 'POST', credentials: 'include'});
};

export const leaveChat = () => {
  fetch(`${getUrlForContactPoint()}/leave`, {method: 'POST', credentials: 'include'});
};

export const addMessage = (text: string) => {
  fetch(`${getUrlForContactPoint()}/send-message`, {
    method: 'POST',
    credentials: 'include',
    body: JSON.stringify({text}),
  });
};

export const fetchWebsocketInfo = (): Promise<{url: string}> =>
  fetch(`${getUrlForContactPoint()}/socket-info`, {credentials: 'include'}, null).then(
    parseResponse,
  );

// Use socket-info as a ping since the ping endpoint isn't publicly exposed
export const ping = () => fetchWebsocketInfo();

export const fetchConversation = (): Promise<Conversation> =>
  fetch(getUrlForContactPoint(), {credentials: 'include'}, null).then(parseResponse);

export const updateMessagePreview = (text: string, typing: boolean) => {
  fetch(`${getUrlForContactPoint()}/typing`, {
    method: 'POST',
    credentials: 'include',
    body: JSON.stringify({text, typing}),
  });
};

export const sendRegistration = (fields: {[string]: string}) =>
  fetch(`${getUrlForContactPoint()}/register`, {
    method: 'POST',
    credentials: 'include',
    body: JSON.stringify({form: fields}),
  });

export const checkForAgents = (): Promise<{available: boolean}> =>
  fetch(
    formatQueryParams(`${getPublicApiUrl()}/agents-available`, {
      platform: 'Chat',
      contactPoint: getContactPoint(),
    }),
  ).then(parseResponse);

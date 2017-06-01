// @flow
import fetch from 'isomorphic-fetch';
import {formatQueryParams} from './utils';
import {getUrlForContactPoint, getPublicApiUrl} from './globals';
import type {Conversation} from 'types';

const parseResponse = (response: Response): Promise<*> => {
  if (response.status && response.status >= 300) {
    return response.json().then(res => Promise.reject(res)).catch(err => Promise.reject(err));
  }

  return response.json();
};

export const joinChat = () => {
  fetch(`${getUrlForContactPoint()}/join`, {
    mode: 'cors',
    credentials: 'include',
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
  });
};

export const leaveChat = () => {
  fetch(`${getUrlForContactPoint()}/leave`, {
    mode: 'cors',
    credentials: 'include',
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
  });
};

export const addMessage = (text: string) => {
  fetch(`${getUrlForContactPoint()}/send-message`, {
    mode: 'cors',
    credentials: 'include',
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({text}),
  });
};

export const fetchWebsocketInfo = (): Promise<{url: string}> =>
  fetch(`${getUrlForContactPoint()}/socket-info`, {
    mode: 'cors',
    credentials: 'include',
  }).then(parseResponse);

// Use socket-info as a ping since the ping endpoint isn't publicly exposed
export const ping = () => fetchWebsocketInfo();

export const fetchConversation = (): Promise<Conversation> =>
  fetch(`${getUrlForContactPoint()}`, {
    mode: 'cors',
    credentials: 'include',
  }).then(parseResponse);

export const updateMessagePreview = (text: string, typing: boolean) => {
  fetch(`${getUrlForContactPoint()}/typing`, {
    mode: 'cors',
    credentials: 'include',
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({text, typing}),
  });
};

export const checkForAgents = (): Promise<{available: boolean}> =>
  fetch(
    formatQueryParams(`${getPublicApiUrl()}/agents-available`, {
      platform: 'Chat',
      contactPoint: CONTACT_POINT,
    }),
    {
      mode: 'cors',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    },
  ).then(parseResponse);

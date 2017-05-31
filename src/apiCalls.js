// @flow
import fetch from 'isomorphic-fetch';
import type {Conversation} from 'types';

// TODO: Get this from somewhere
const GLOBALS = {
  HOST: 'https://nate.dev.quiq.sh',
  CONTACT_POINT: 'default',
};

const {HOST, CONTACT_POINT} = GLOBALS;

const parseResponse = (response: Response): Promise<*> => {
  if (response.status && response.status >= 300) {
    return response.json().then(res => Promise.reject(res)).catch(err => Promise.reject(err));
  }

  return response.json();
};

export const joinChat = () => {
  fetch(`${HOST}/api/v1/messaging/chat/${CONTACT_POINT}/join`, {
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
  fetch(`${HOST}/api/v1/messaging/chat/${CONTACT_POINT}/leave`, {
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
  fetch(`${HOST}/api/v1/messaging/chat/${CONTACT_POINT}/send-message`, {
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
  fetch(`${HOST}/api/v1/messaging/chat/${CONTACT_POINT}/socket-info`, {
    mode: 'cors',
    credentials: 'include',
  }).then(parseResponse);

// Use socket-info as a ping since the ping endpoint isn't publicly exposed
export const ping = () => fetchWebsocketInfo();

export const fetchConversation = (): Promise<Conversation> =>
  fetch(`${HOST}/api/v1/messaging/chat/${CONTACT_POINT}`, {
    mode: 'cors',
    credentials: 'include',
  }).then(parseResponse);

export const updateMessagePreview = (text: string, typing: boolean) => {
  fetch(`${HOST}/api/v1/messaging/chat/${CONTACT_POINT}/typing`, {
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
  fetch(`${HOST}/api/v1/messaging/agents-available?platform=Chat&contactPoint=${CONTACT_POINT}`, {
    mode: 'cors',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
  }).then(parseResponse);

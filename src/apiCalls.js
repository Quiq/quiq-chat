// @flow
import {formatQueryParams, burnItDown, onceAtATime} from './Utils/utils';
import {
  getUrlForContactPoint,
  getPublicApiUrl,
  getContactPoint,
  getSessionApiUrl,
  getGenerateUrl,
} from './globals';
import quiqFetch from './quiqFetch';
import {setAccessToken, getAccessToken, getTrackingId} from './storage';
import type {Conversation, ChatMetadata, UploadDirective, EmailTranscriptPayload} from 'types';
import logger from './logging';
import Raven from 'raven-js';

const log = logger('apiCalls');

let _onNewSession: (newTrackingId: string) => any;

export const registerNewSessionCallback = (callback: (newTrackingId: string) => any) => {
  _onNewSession = callback;
};

export const keepAlive = () => quiqFetch(`${getUrlForContactPoint()}/keep-alive`, {method: 'POST'});

export const getChatConfiguration = (): Promise<ChatMetadata> =>
  quiqFetch(`${getUrlForContactPoint()}/configuration`, undefined, {responseType: 'JSON'});

export const sendTextMessage = (text: string) =>
  quiqFetch(`${getUrlForContactPoint()}/send-message`, {
    method: 'POST',
    body: JSON.stringify({text}),
  });

export const sendAttachmentMessage = (uploadId: string): Promise<{id: string}> =>
  quiqFetch(
    `${getUrlForContactPoint()}/send-attachment`,
    {
      method: 'POST',
      body: JSON.stringify({uploadId}),
    },
    {
      responseType: 'JSON',
      requestType: 'JSON',
    },
  );

export type UploadDirectivesResponse = {
  uploads: Array<UploadDirective>,
};
export const getAttachmentMessageUploadDirectives = (
  numUploads: number = 1,
): Promise<UploadDirectivesResponse> =>
  quiqFetch(
    `${getUrlForContactPoint()}/prepare-uploads`,
    {
      method: 'POST',
      body: JSON.stringify({numUploads}),
    },
    {
      responseType: 'JSON',
      requestType: 'JSON',
    },
  );

export const fetchWebsocketInfo = (): Promise<{url: string, protocol: string}> =>
  quiqFetch(`${getUrlForContactPoint()}/socket-info`, undefined, {responseType: 'JSON'});

// Use socket-info as a ping since the ping endpoint isn't publicly exposed
export const ping = () => fetchWebsocketInfo();

export const fetchConversation = (): Promise<Conversation> =>
  quiqFetch(getUrlForContactPoint(), undefined, {responseType: 'JSON'});

export const updateTypingIndicator = (text: string, typing: boolean) =>
  quiqFetch(`${getUrlForContactPoint()}/typing`, {
    method: 'POST',
    body: JSON.stringify({text, typing}),
  });

export const sendRegistration = (fields: {[string]: string}, formVersionId?: string) =>
  quiqFetch(`${getUrlForContactPoint()}/register`, {
    method: 'POST',
    body: JSON.stringify({form: fields, formVersionId}),
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

export const emailTranscript = (data: EmailTranscriptPayload) =>
  quiqFetch(`${getUrlForContactPoint()}/email-transcript`, {
    method: 'POST',
    body: JSON.stringify(data),
  });

/**
 * Creates a new session and tracking ID
 * NOTE: We ensure that this function is never invoked simultaneously, so as to prevent multiple trackingID related race conditions
 *
 * @param host - Host against which to call /generate
 * @param sessionChange - Indicates whether this is being called to replace old session. Results in newSession callback being fired.
 */
export const login = onceAtATime((host?: string) =>
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

    if (getAccessToken() !== res.accessToken) {
      burnItDown();
      return Promise.reject();
    }

    if (_onNewSession) {
      _onNewSession(res.tokenId);
    }

    const trackingId = getTrackingId();

    // Tell sentry about the new trackingId
    // This will let us track logs by trackingId
    Raven.setUserContext({
      id: trackingId,
    });

    log.info(`Login successful. trackingId: ${trackingId || 'unknown'}`);

    return trackingId;
  }),
);

export const logout = () => quiqFetch(getSessionApiUrl(), {method: 'DELETE'});

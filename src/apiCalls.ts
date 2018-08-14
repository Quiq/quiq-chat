import { formatQueryParams, burnItDown, onceAtATime } from './Utils/utils';
import quiqFetch from './quiqFetch';
import ChatState from './State';
import {
  Conversation,
  ChatMetadata,
  UploadDirective,
  EmailTranscriptPayload,
  QuiqJwt,
} from './types';
import logger from './logging';
import Raven from 'raven-js';
import jwt_decode from 'jwt-decode';

interface SocketInfo {
  url: string;
  protocol: string;
}

const log = logger('apiCalls');

let _onNewSession: (newTrackingId: string) => any;

const getHost = (cached: boolean): string => {
  if (!ChatState.host) {
    log.error('Tried to get host (for making API call) before `host` was set in ChatState');
    return '';
  }

  if (
    ChatState.host &&
    (ChatState.host.includes('goquiq.com') ||
      ChatState.host.includes('quiq.dev') ||
      (ChatState.host.includes('quiq-api') && cached))
  ) {
    return ChatState.host;
  }

  try {
    const vanityName = ChatState.host.split('.')[0].split('https://')[1];
    return `https://${vanityName}.goquiq.com`;
  } catch (e) {
    return ChatState.host;
  }
};

const getPublicApiUrl = (cached: boolean = false) => `${getHost(cached)}/api/v1/messaging`;

const getUrlForContactPoint = (cached: boolean = false) =>
  `${getHost(cached)}/api/v1/messaging/chat/${ChatState.contactPoint}`;

const getGenerateUrl = (cached: boolean = false) => `${getHost(cached)}/api/v1/token/generate`;

export const registerNewSessionCallback = (callback: (newTrackingId: string) => any) => {
  _onNewSession = callback;
};

export const getChatConfiguration = (): Promise<ChatMetadata> =>
  quiqFetch(`${getUrlForContactPoint(true)}/configuration`, undefined, { responseType: 'JSON' });

export const sendTextMessage = (text: string) =>
  quiqFetch(`${getUrlForContactPoint()}/send-message`, {
    method: 'POST',
    body: JSON.stringify({ text }),
  });

export const sendAttachmentMessage = (uploadId: string): Promise<{ id: string }> =>
  quiqFetch(
    `${getUrlForContactPoint()}/send-attachment`,
    {
      method: 'POST',
      body: JSON.stringify({ uploadId }),
    },
    {
      responseType: 'JSON',
      requestType: 'JSON',
    },
  );

export type UploadDirectivesResponse = {
  uploads: Array<UploadDirective>;
};
export const getAttachmentMessageUploadDirectives = (
  numUploads: number = 1,
): Promise<UploadDirectivesResponse> =>
  quiqFetch(
    `${getUrlForContactPoint()}/prepare-uploads`,
    {
      method: 'POST',
      body: JSON.stringify({ numUploads }),
    },
    {
      responseType: 'JSON',
      requestType: 'JSON',
    },
  );

export const fetchWebsocketInfo = (): Promise<SocketInfo> =>
  quiqFetch(`${getUrlForContactPoint()}/socket-info`, undefined, { responseType: 'JSON' });

export const fetchConversation = (): Promise<Conversation> =>
  quiqFetch(getUrlForContactPoint(), undefined, { responseType: 'JSON' });

export const updateTypingIndicator = (text: string, typing: boolean) =>
  quiqFetch(`${getUrlForContactPoint()}/typing`, {
    method: 'POST',
    body: JSON.stringify({ text, typing }),
  });

export const sendRegistration = (fields: { [fieldId: string]: string }, formVersionId?: string) =>
  quiqFetch(`${getUrlForContactPoint()}/register`, {
    method: 'POST',
    body: JSON.stringify({ form: fields, formVersionId }),
  });

export const checkForAgents = (): Promise<{ available: boolean }> =>
  quiqFetch(
    formatQueryParams(`${getPublicApiUrl(true)}/agents-available`, {
      platform: 'Chat',
      contactPoint: ChatState.contactPoint,
    }),
    undefined,
    { responseType: 'JSON', cached: true },
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
 * @param sessionChange - Indicates whether this is being called to replace old session. Results in newSession callback being fired.
 */
export const login = onceAtATime(() =>
  quiqFetch(
    getGenerateUrl(),
    {
      method: 'POST',
    },
    {
      responseType: 'JSON',
      requestType: 'JSON',
    },
  ).then((res: { accessToken: string; tokenId: string }) => {
    const oldTrackingId = ChatState.trackingId;
    ChatState.accessToken = res.accessToken;

    const { sub: newTrackingId } = jwt_decode<QuiqJwt>(res.accessToken);
    ChatState.trackingId = newTrackingId;

    // Ensure we were able to store access token properly
    if (ChatState.accessToken !== res.accessToken) {
      burnItDown();
      throw new Error('Unable to store new access token in local storage. Burning down.');
    }

    if (_onNewSession) {
      _onNewSession(res.tokenId);
    }

    // Tell sentry about the new trackingId
    // This will let us track logs by trackingId
    Raven.setUserContext({
      id: newTrackingId,
    });

    log.info(`Login successful. trackingId: ${newTrackingId || 'unknown'}`);

    return { trackingId: newTrackingId, oldTrackingId };
  }),
);

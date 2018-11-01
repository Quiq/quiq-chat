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
import jwt_decode from 'jwt-decode';
import { developmentDomains } from './appConstants';

interface SocketInfo {
  url: string;
  protocol: string;
}

const log = logger('apiCalls');

let _onNewSession: (newTrackingId: string) => any;

const getHost = (cached: boolean): string => {
  if (!ChatState.host) {
    log.error('Tried to get host (for making API call) before `host` was set in ChatState', {
      logOptions: { frequency: 'session', logFirstOccurrence: true },
    });
    return '';
  }

  try {
    if (
      developmentDomains.some(
        d => !!(ChatState.host && ChatState.host.hostname && ChatState.host.hostname.includes(d)),
      )
    ) {
      return ChatState.host.rawUrl;
    }

    const vanityName = ChatState.host.hostname && ChatState.host.hostname.split('.')[0];

    if (!vanityName) {
      // Fallback to specified host in case of parsing error
      log.error("Couldn't determine vanity name, falling back to provided host", {
        logOptions: { frequency: 'session', logFirstOccurrence: true },
      });
      return ChatState.host.rawUrl;
    }

    // If this is a cached endpoint, use quiq-api.com
    if (cached) {
      return `https://${vanityName}.quiq-api.com`;
    }

    // Otherwise, this is a dynamic endpoint; use goquiq.com
    return `https://${vanityName}.goquiq.com`;
  } catch (e) {
    // Fallback to specified host in case of parsing error
    log.error("Couldn't determine host name, falling back to provided host", {
      exception: e,
      logOptions: { frequency: 'session', logFirstOccurrence: true },
    });
    return ChatState.host.rawUrl;
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

export const sendMessage = (payload: {
  text: string;
  postbackData?: Object;
  replyDirectives?: Object;
}) =>
  quiqFetch(`${getUrlForContactPoint()}/send-message`, {
    method: 'POST',
    body: JSON.stringify(payload),
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

    log.info(`Login successful. trackingId: ${newTrackingId || 'unknown'}`);

    return { trackingId: newTrackingId, oldTrackingId };
  }),
);

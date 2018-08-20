export const MAX_SOCKET_CONNECTION_ATTEMPTS = 20;

export enum MessageFailureCodes {
  UNKNOWN = 11001,
  INFECTED_UPLOAD = 11002,
  CONTENT_TYPE_NOT_ALLOWED = 11003,
  UPLOAD_NOT_FOUND = 11004,
  EMPTY_UPLOAD = 11005,
}

export const developmentDomains = ['quiq.dev', 'quiq.sh'];
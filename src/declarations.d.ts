// TODO: quiq-socket needs a d.ts file!!
declare module 'quiq-socket';

// TODO: stubborn-fetch needs a d.ts file!!
declare module 'stubborn-fetch' {
  const module: any;
  export class StubbornFetchError extends Error {
    data: any;
    type: string;
    static types: {
      MAX_ERRORS_EXCEEDED: string;
      RATE_LIMITED: string;
      HTTP_ERROR: string;
      TIMEOUT: string;
    };
  }
  export default module;
}

declare module '*.json' {
  const value: any;
  export const version: string;
  export default value;
}

declare module 'loglevel-plugin-prefix';

// @flow
import atmosphere from 'atmosphere.js';
import {ping} from './apiCalls';
import {isIE9, burnItDown} from './utils';
import type {
  AtmosphereRequest,
  AtmosphereResponse,
  AtmosphereConnection,
  AtmosphereConnectionBuilder,
  AtmosphereMessage,
  WebsocketCallbacks,
} from 'types';

let connection: AtmosphereConnection;
let callbacks: WebsocketCallbacks;
let ie9Ping: number;

const buildRequest = (socketUrl: string) => {
  // TODO: Add a way to specify transport
  let transport = 'websocket';
  if (isIE9()) {
    transport = 'jsonp';
  }

  /* eslint-disable no-use-before-define */
  return {
    url: `https://${socketUrl}`,
    enableXDR: true,
    headers: {'X-Quiq-Line': '1'},
    withCredentials: true,
    contentType: 'application/json',
    logLevel: 'error',
    transport,
    fallbackTransport: 'long-polling',
    trackMessageLength: true,
    maxReconnectOnClose: 100,
    // Keep reconnectInterval at 10 seconds.  Otherwise if API-GW drops the atmosphere connection,
    // we will hammer them with onReconnect requests. See SER-2620
    reconnectInterval: 10000,
    onOpen,
    onClose,
    onReopen,
    onReconnect,
    onMessage,
    onTransportFailure,
    onError,
    onClientTimeout,
  };
  /* eslint-disable no-use-before-define */
};

export const connectSocket = (builder: AtmosphereConnectionBuilder) => {
  const {socketUrl, callbacks: websocketCallbacks} = builder;

  callbacks = websocketCallbacks;

  if (isIE9() && !ie9Ping) {
    // JSONP seems to be a bit unreliable, but we can prod it by periodically pinging the server...
    ie9Ping = setInterval(ping, 2000);
  }

  connection = {...atmosphere.subscribe(buildRequest(socketUrl))};
};

export const disconnectSocket = () => {
  atmosphere.unsubscribe();
};

// ******** Atmosphere callbacks *********
const onOpen = response => {
  // Carry the UUID. This is required if you want to call subscribe(request) again.
  connection.request.uuid = response.request.uuid;
  callbacks.onConnectionEstablish && callbacks.onConnectionEstablish();
};

const onReopen = () => {
  callbacks.onConnectionEstablish && callbacks.onConnectionEstablish();
};

const onReconnect = (req: AtmosphereRequest) => {
  // Long-polling doesn't clear up the error until it gets something back from the server
  // Force this to happen by sending a ping.
  clearTimeout(connection.pingTimeout);
  if (req.transport === 'long-polling') {
    connection.pingTimeout = setTimeout(() => {
      ping();
    }, connection.request.reconnectInterval + 5000);
  }
};

const onMessage = (res: AtmosphereResponse) => {
  let message;
  try {
    message = atmosphere.util.parseJSON(res.responseBody);
    if (message.messageType === 'BurnItDown') {
      burnItDown(message.data);
      if (callbacks.onBurn) callbacks.onBurn(message.data);
      return;
    }

    callbacks.onMessage && callbacks.onMessage(message);
  } catch (e) {
    console.error('Error parsing Quiq websocket message');
    return;
  }
};

const onTransportFailure = (errorMsg: string, req: AtmosphereRequest) => {
  callbacks.onTransportFailure && callbacks.onTransportFailure(errorMsg, req);
};

const onError = () => {
  callbacks.onConnectionLoss && callbacks.onConnectionLoss();
};

const onClientTimeout = () => {
  callbacks.onConnectionLoss && callbacks.onConnectionLoss();
};

const onClose = () => {
  callbacks.onClose && callbacks.onClose();
};

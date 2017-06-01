// @flow
import atmosphere from 'atmosphere.js';
import {ping} from './apiCalls';
import {isIE9} from './utils';
import type {
  AtmosphereRequest,
  AtmosphereConnection,
  AtmosphereConnectionBuilder,
  AtmosphereMessage,
} from 'types';

let connection: AtmosphereConnection;
let onConnectionLoss: () => void;
let onConnectionEstablish: () => void;
let handleMessage: (message: AtmosphereMessage) => void;
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
    withCredentials: true,
    contentType: 'application/json',
    logLevel: 'error',
    transport,
    fallbackTransport: 'long-polling',
    trackMessageLength: true,
    maxReconnectOnClose: Number.MAX_SAFE_INTEGER,
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
  const {socketUrl, options} = builder;

  onConnectionLoss = options.onConnectionLoss;
  onConnectionEstablish = options.onConnectionEstablish;
  handleMessage = options.handleMessage;

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
  onConnectionEstablish && onConnectionEstablish();
  console.log('Socket open');
};

const onReopen = () => {
  console.log('Socket reopened');
  onConnectionEstablish && onConnectionEstablish();
};

const onReconnect = (req: AtmosphereRequest) => {
  // Long-polling doesn't clear up the error until it gets something back from the server
  // Force this to happen by sending a ping.
  clearTimeout(connection.pingTimeout);
  if (req.transport === 'long-polling') {
    connection.pingTimeout = setTimeout(() => {
      ping();
      console.log('Atmosphere: ping sent');
    }, connection.request.reconnectInterval + 5000);
  }
  console.log('Atmosphere: reconnect');
};

const onMessage = res => {
  let message;
  try {
    message = atmosphere.util.parseJSON(res.responseBody);
    handleMessage && handleMessage(message);
  } catch (e) {
    console.error('Error parsing Quiq websocket message');
    return;
  }

  console.log(message);
};

const onTransportFailure = (errorMsg: string, req: AtmosphereRequest) => {
  console.log(`Transport failed: ${req.transport}`);
};

const onError = () => {
  console.log('Atmosphere error');
  onConnectionLoss && onConnectionLoss();
};

const onClientTimeout = () => {
  console.log('Atmosphere client timeout');
  onConnectionLoss && onConnectionLoss();
};

const onClose = () => {
  console.log('Atmosphere connection closed');
};

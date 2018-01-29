// @flow

/**
 * @callback QuiqSocket~connectionLossCallback
 * @param {number} code - Numeric reason code.
 * @param {string} reason - Human-readable reason for websocket close.
 */

/**
 * @callback QuiqSocket~messageCallback
 * @param {AtmosphereMessage} message - Received message
 */

/**
 * @callback QuiqSocket~connectionEstablishCallback
 */

/**
 * @callback QuiqSocket~fatalErrorCallback
 */

import StatusCodes from './StatusCodes';
import logger from 'logging';
import clamp from 'lodash/clamp';
import {getAccessToken, getTrackingId, isStorageEnabled} from 'storage';
import {getBurned} from 'globals';
import {formatQueryParams} from 'Utils/utils';
import {version} from '../../package.json';
import type {Interval, Timeout} from 'types';

const log = logger('QuiqSocket');

type Timers = {
  connectionTimeout: ?Timeout, // Timeout for connection/handshake attempt
  retryTimeout: ?Timeout, // Timeout for backoff on retry attempts
  heartbeat: {
    interval: ?Interval, // Interval for sending of heartbeat
    timeout: ?Timeout, // Timeout for receiving a pong back from the server
  },
};

class QuiqSocket {
  // Socket endpoint
  url: ?string;

  // External event callbacks
  connectionLossHandler: ?(reasonCode: number, message: string) => any;
  connectionEstablishHandler: ?() => any;
  messageHandler: ?(data: Object) => any;
  fatalErrorHandler: ?() => any;

  // Websocket options
  options = {
    // Number of times to attempt reconnecting on a single connection
    maxRetriesOnConnectionLoss: 100,

    // Function of the form attempt => delay used for delaying retry attempts
    backoffFunction: (attempt: number) => clamp((attempt ** 2 - 1) / 2 * 1000, 0, 30000),

    // the maximum number of times connect() will be called, either externally or in doing retries, for the entire session.
    maxConnectionCount: 100,

    // The timeout for WebSocket.onopen to be called for a connection attempt.
    connectionAttemptTimeout: 10 * 1000,

    // Frequency to send ping across websocket
    heartbeatFrequency: 50 * 1000,

    // Initiate reconnect if pong is not received in this time
    heartBeatTimeout: 20 * 1000,
  };

  // Internal WebSocket instance
  socket: ?WebSocket;

  // Retry and connection counting
  retries: number = 0;
  connectionCount: number = 0;

  // Timers and intervals
  timers: Timers = {
    connectionTimeout: null,
    retryTimeout: null,
    heartbeat: {
      interval: null,
      timeout: null,
    },
  };

  // Connection state
  lastPongReceivedTimestamp: number;

  // Status flags
  waitingForOnlineToReconnect: boolean = false;

  constructor() {
    // Option validation
    if (this.options.heartBeatTimeout >= this.options.heartbeatFrequency) {
      log.error('Heartbeat timeout must be less than heartbeat interval');
    }

    // NOTE: We use 'waitingForOnlineToReconnect' as a flag for whether to attempt reconnecting after an 'online' event.
    // In other words, QuiqSocket must have recorded an 'offline' event prior to the 'online' event if it's going to reconnect.
    window.addEventListener('online', () => {
      log.info('QuiqSocket online event');
      if (this.waitingForOnlineToReconnect) {
        this.connect();
      }
      this.waitingForOnlineToReconnect = false;
    });

    window.addEventListener('offline', () => {
      log.info('QuiqSocket offline event');
      if (this.socket) {
        this.waitingForOnlineToReconnect = true;
        this._reset();
        if (this.connectionLossHandler) {
          this.connectionLossHandler(0, 'Browser offline');
        }
      }
    });

    // Unload listener - the browser implementation should send close frame automatically, but you can never be too sure...
    window.addEventListener('unload', () => {
      log.info('QuiqSocket unload event');
      if (this.socket) {
        this._reset();
      }
      return null;
    });

    // Focus listener: this is used to detect computer coming back from sleep, but will be fired anytime tab is focused.
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        this._verifyConnectivity();
      }
    });
  }

  /** ******************************
   * Public Methods
   ****************************** */

  /**
   * Sets the socket endpoint to connect to. Must be called prior to calling connect()
   * @param {string} url - A websocket endpoint. Must begin with `ws://` or `wss://`
   * @returns {QuiqSocket} This instance of QuiqSocket, to allow for chaining
   */
  withURL = (url: string): QuiqSocket => {
    this.url = url;
    return this;
  };

  /**
   * Sets the callback to be executed when the websocket connection is lost unexpectedly.
   * @param {QuiqSocket~connectionLossCallback} f - The callback function
   * @returns {QuiqSocket} This instance of QuiqSocket, to allow for chaining
   */
  onConnectionLoss = (f: (reasonCode: number, message: string) => any): QuiqSocket => {
    this.connectionLossHandler = f;
    return this;
  };

  /**
   * Sets the callback to be executed when the websocket connection is established, either for the first time or upon reconnecting after an error..
   * @param {QuiqSocket~connectionEstablishCallback} f - The callback function
   * @returns {QuiqSocket}
   */
  onConnectionEstablish = (f: () => any): QuiqSocket => {
    this.connectionEstablishHandler = f;
    return this;
  };

  /**
   * Sets the callback to be executed when a message is received on the websocket.
   * @param {QuiqSocket~messageCallback} f - The callback function
   * @returns {QuiqSocket} This instance of QuiqSocket, to allow for chaining
   */
  onMessage = (f: (data: Object) => any): QuiqSocket => {
    this.messageHandler = f;
    return this;
  };

  /**
   * Sets the callback to be executed when a a non-recoverable error (such as exceeding the retry or connection limit) occurs.
   * @param {QuiqSocket~fatalErrorCallback} f - The callback function
   * @returns {QuiqSocket} This instance of QuiqSocket, to allow for chaining
   */
  onFatalError = (f: () => any): QuiqSocket => {
    this.fatalErrorHandler = f;
    return this;
  };

  /**
   * Connect the websocket. `withURL()` must be called prior to calling this method.
   * If a WS connection is currently open, it is closed and a new one is created.
   * @returns {QuiqSocket} This instance of QuiqSocket, to allow for chaining
   */
  connect = (): QuiqSocket => {
    // Check burn status
    if (getBurned()) {
      log.info('Client in bad state. Aborting websocket connection.');
      return this;
    }

    if (!window.WebSocket) {
      throw new Error('QuiqSockets: This browser does not support websockets');
    }

    if (!isStorageEnabled()) {
      log.error('Storage not enabled. Aborting execution');
      this._handleFatalError();
      return this;
    }

    if (this.connectionCount >= this.options.maxConnectionCount) {
      log.error('Maximum connection count exceeded. Aborting.');
      this._handleFatalError();
      return this;
    }

    // Reset connection and tiemout state
    this._reset();

    log.info('Connecting socket...');

    // Retrieve auth token from local storage
    const accessToken = getAccessToken();
    if (!accessToken) {
      log.error('QuiqSocket was unable to retrieve the access token from storage.');
      return this;
    }

    // Check that we have a URL
    if (!this.url) {
      log.error('A URL must be provided before connecting. Aborting connection.');
      return this;
    }

    // Connect socket.
    const parsedUrl = formatQueryParams(this.url, {
      trackingId: getTrackingId() || 'noAssociatedTrackingId',
      quiqVersion: version,
    });

    // Set tiemout to trigger reconnect if _onOpen isn't called quiqly enough
    this.timers.connectionTimeout = setTimeout(() => {
      log.warn('Connection attempt timed out.');
      this._retryConnection();
    }, this.options.connectionAttemptTimeout);

    // Make connection
    try {
      this.socket = new WebSocket(parsedUrl, accessToken);
    } catch (e) {
      log.error(`Unable to construct WebSocket: ${e.message}`, {
        data: {url: parsedUrl},
        exception: e,
      });
      throw new Error('Cannot construct WebSocket.');
    }

    // Register internal event handlers with WebSocket instance.
    this.socket.onopen = this._handleOpen;
    this.socket.onclose = this._handleClose;
    this.socket.onerror = this._handleSocketError;
    this.socket.onmessage = this._handleMessage;

    // Increment "global" connection count
    this.connectionCount++;

    return this;
  };

  /**
   * Disconnect the websocket. If no connection is active has no effect, but does not error out.
   * @returns {QuiqSocket} This instance of QuiqSocket, to allow for chaining
   */
  disconnect = (): QuiqSocket => {
    if (this.socket) {
      log.info('Closing socket intentionally');
    }

    this._reset();

    return this;
  };

  /** ******************************
   * Private Members
   ****************************** */

  /**
   * Initiates reconnection attempt. Delays attempt based on `options.backoffFunction`.
   * @private
   */
  _retryConnection = () => {
    if (this.retries >= this.options.maxRetriesOnConnectionLoss) {
      log.error('Maximum socket connection retries exceeded. Aborting connection.');
      this._handleFatalError();
      return;
    }

    log.info(
      `Initiating retry attempt ${this.retries + 1} of ${this.options.maxRetriesOnConnectionLoss}`,
    );

    const delay = this.options.backoffFunction.call(this, this.retries);

    // Reset state
    this._reset();

    log.info(`Delaying socket reconnect attempt for ${delay} ms`);

    setTimeout(this.connect, delay);

    this.retries++;
  };

  /**
   * Resets all connection-specific state including the WebSocket instance itself and all timers.
   * Removes all event handlers for WebSocket. Does **not** reset retry count. (This is done in the onOpen handler.)
   * This method is idempotent...use it liberally to ensure multiple socket connections are not created.
   * @private
   */
  _reset = () => {
    // Close existing connection
    if (this.socket) {
      // Remove event handlers -- we don't care about this socket anymore.
      this.socket.onopen = () => {};
      this.socket.onclose = () => {};
      this.socket.onerror = () => {};
      this.socket.onmessage = () => {};

      // NOTE: Tests have shown that the below is an effective way to close the socket even when called while the readyState is CONNECTING
      this.socket.close(StatusCodes.closeNormal, 'Closing socket');
      this.socket = null;

      log.info('Closed existing connection and removed event handlers.');
    }

    if (this.timers.retryTimeout) {
      clearTimeout(this.timers.retryTimeout);
      this.timers.retryTimeout = null;
      log.info('Invalidated retry delay timeout');
    }

    if (this.timers.connectionTimeout) {
      clearTimeout(this.timers.connectionTimeout);
      this.timers.connectionTimeout = null;
      log.info('Invalidated connection open timeout');
    }

    if (this.timers.heartbeat.interval) {
      clearInterval(this.timers.heartbeat.interval);
      this.timers.heartbeat.interval = null;
      log.info('Invalidated heartbeat interval');
    }

    if (this.timers.heartbeat.timeout) {
      clearInterval(this.timers.heartbeat.timeout);
      this.timers.heartbeat.timeout = null;
      log.info('Invalidated heartbeat timeout');
    }
  };

  /**
   * Internal handler for handling a new WebSocket message. Parses data payload and fires callback.
   * @param {MessageEvent} e
   * @private
   */
  _handleMessage = (e: MessageEvent) => {
    // If this is a pong, update pong timestamp and clear heartbeat timeout
    if (e.data && e.data === 'X') {
      this.lastPongReceivedTimestamp = Date.now();
      if (this.timers.heartbeat.timeout) {
        clearTimeout(this.timers.heartbeat.timeout);
        this.timers.heartbeat.timeout = null;
      }
      return;
    }

    try {
      // Make sure data is a string
      if (typeof e.data === 'string') {
        const parsedData = JSON.parse(e.data);
        // Fire event handler
        if (this.messageHandler) {
          this.messageHandler(parsedData);
        }
      } else {
        log.error('Websocket message data was not of string type');
      }
    } catch (ex) {
      log.error(`Unable to handle websocket message: ${ex.message}`, {
        data: {message: e.data},
        exception: ex,
      });
    }
  };

  /**
   * Internal handler for socket open. Clears connection timeout and retry count. Fires external callback.
   * @private
   */
  _handleOpen = () => {
    if (!this.socket || !this.socket.url) {
      log.error('Open handler called, but socket or socket URL was undefined');
      return;
    }

    log.info(`Socket opened to ${this.socket.url}`);

    // Clear timeout
    if (this.timers.connectionTimeout) {
      clearTimeout(this.timers.connectionTimeout);
      this.timers.connectionTimeout = null;
    }

    // Reset retry count
    this.retries = 0;

    // Begin heartbeats
    this._startHeartbeat();

    // Fire event handler
    if (this.connectionEstablishHandler) {
      this.connectionEstablishHandler();
    }
  };

  /**
   * Internal handler for WebSocket unexpected close. Calls reset(), then initiates new connection.
   * @param {CloseEvent} e
   * @private
   */
  _handleClose = (e: CloseEvent) => {
    const dirtyOrClean = e.wasClean ? 'CLEANLY' : 'DIRTILY';
    log.info(`Socket ${dirtyOrClean} closed unexpectedly with code ${e.code}: ${e.reason}.`);

    // TODO: handle code 1015 (TCP 1.1 not supported)
    // TODO: Investigate other status codes to handle specifically

    // Reset state
    this._reset();

    // Fire callback
    if (this.connectionLossHandler) {
      this.connectionLossHandler(e.code, e.reason);
    }

    // Initiate retry procedure
    this._retryConnection();
  };

  /**
   * WebSocket error handler. Logs warning, but does nothing else. (Close handler will deal with error resolution.)
   * @private
   */
  _handleSocketError = (e: any) => {
    // NOTE: onError event is not provided with any information, onClose must deal with causeality.
    // This is simply a notification.
    // We'll pass a potential exception just in case; apparently some browsers will provide one.
    log.warn('A websocket error occurred.', {exception: e});
  };

  /**
   * Handles a fatal, non-recoverable error such as hitting the retry maximum.
   * @private
   */
  _handleFatalError = () => {
    log.error('QuiqSocket encountered a fatal error.');

    if (this.fatalErrorHandler) {
      this.fatalErrorHandler();
    }
  };

  /**
   * Initiates websocket heartbeat interval. Must be called upon websocket open. Heartbeat interval must be cleared upon socket close.
   * @private
   */
  _startHeartbeat = () => {
    if (this.timers.heartbeat.interval) {
      clearInterval(this.timers.heartbeat.interval);
    }

    // Update pong time
    this.lastPongReceivedTimestamp = Date.now();

    this.timers.heartbeat.interval = setInterval(() => {
      // Initiate heartbeat timeout--we must receive a pong back within this time frame.
      // This will be cleared when we receive an 'X'
      if (this.timers.heartbeat.timeout) {
        clearTimeout(this.timers.heartbeat.timeout);
      }
      this.timers.heartbeat.timeout = setTimeout(() => {
        log.warn('Heartbeat pong not received back in time. Reconnecting.');
        if (this.connectionLossHandler) {
          this.connectionLossHandler(0, 'Heartbeat timeout');
        }
        this._reset();
        this.connect();
      }, this.options.heartBeatTimeout);

      // Verify we have a socket connection
      if (!this.socket) {
        log.error('Trying to send heartbeat, but no socket connection exists.');
        return;
      }

      // Send ping
      this.socket.send('X');
    }, this.options.heartbeatFrequency);
  };

  _verifyConnectivity = () => {
    // Only continue if we are in CONNECTED state (readyState === 1)
    if (!this.socket || this.socket.readyState !== 1 || !this.lastPongReceivedTimestamp) return;

    log.debug('Verifying connectivity');

    if (Date.now() - this.lastPongReceivedTimestamp > this.options.heartbeatFrequency) {
      log.info('Our heart has skipped a beat...reconnecting.');
      // Fire event handler
      if (this.connectionLossHandler) {
        this.connectionLossHandler(1001, 'Heartbeat failure');
      }
      // Reconnect
      this.connect();
    }
  };
}

// Export singleton instance of QuiqSocket
export default new QuiqSocket();

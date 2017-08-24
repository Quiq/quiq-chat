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
import logger from '../logging';
import {clamp} from 'lodash';
import {getAccessToken} from '../storage';
import type {Interval, Timeout} from '../types';

const log = logger('QuiqSocket');

class QuiqSocket {
  // Socket endpoint
  url: ?string;

  // External event callbacks
  connectionLossHandler: ?(reasonCode: number, message: string) => any;
  connectionEstablishHandler: ?() => any;
  messageHandler: ?(data: Object) => any;
  fatalErrorHandler: ?() => any;

  // Websocket options
  options: {[string]: any} = {
    maxRetriesOnConnectionLoss: 10,
    backoffFunction: (attempt: number) => clamp((attempt ** 2 - 1) / 2 * 1000, 0, 30000),
    maxConnectionCount: 100,
    connectionAttemptTimeout: 10 * 1000,
    heartbeatFrequency: 50 * 1000,
  };

  // Internal WebSocket instance
  socket: ?WebSocket;

  // Retry and connection counting
  retries: number = 0;
  connectionCount: number = 0;

  // Timers and intervals
  connectionTimeout: ?Timeout;
  retryTiemout: ?Timeout;
  heartbeatInterval: ?Interval;

  waitingForOnlineToReconnect: boolean = false;

  constructor() {
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
  }

  /********************************
   * Public Methods
   *******************************/

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
   * @returns {QuiqSocket} This instance of QuiqSocket, to allow for chaining
   */
  connect = (): QuiqSocket => {
    if (!window.WebSocket) {
      throw new Error('QuiqSockets: This browser does not support websockets');
    }

    if (this.connectionCount >= this.options.maxConnectionCount) {
      log.error('Maximum connection count exceeded. Aborting.');
      this._handleFatalError();
      return this;
    }

    log.info('Connecting socket...');

    // Reset connection and tiemout state
    this._reset();

    // Retrieve auth token from local storage
    const accessToken = getAccessToken();
    if (!accessToken) {
      log.error('QuiqSocket was unable to retrieve the access token from storage.');
      return this;
    }

    if (!this.url) {
      log.error('A URL must be provided before connecting. Aborting connection.');
      return this;
    }

    try {
      this.socket = new WebSocket(this.url, accessToken);
    } catch (e) {
      log.error(`Unable to construct WebSocket: ${e}`);
      throw new Error('Cannot construct WebSocket.');
    }

    this.socket.onopen = this._handleOpen;
    this.socket.onclose = this._handleClose;
    this.socket.onerror = this._handleSocketError;
    this.socket.onmessage = this._handleMessage;

    this.connectionCount++;

    // Set tiemout to trigger reconnect
    this.connectionTimeout = setTimeout(() => {
      log.debug('Connection attempt timed out.');
      this._retryConnection();
    }, this.options.connectionAttemptTimeout);

    return this;
  };

  /**
   * Disconnect the websocket. If no connection is active has no effect, but does not error out.
   * @returns {QuiqSocket} This instance of QuiqSocket, to allow for chaining
   */
  disconnect = (): QuiqSocket => {
    log.info('Closing socket intentionally');

    this._reset();

    return this;
  };

  /********************************
   * Private Members
   *******************************/

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
   * Resets all connection-specific state including the WebSocket instance itself and all timers. Removes all event handlers for WebSocket. Does **not** reset retry count. (This is done in the onOpen handler.)
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

      this.socket.close(StatusCodes.closeNormal, 'Closing socket');
      this.socket = null;

      log.info('Closed existing connection and removed event handlers.');
    }

    if (this.retryTiemout) {
      clearTimeout(this.retryTiemout);
      this.retryTiemout = null;
      log.info('Invalidated retry delay timeout');
    }

    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = null;
      log.info('Invalidated connection open timeout');
    }

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
      log.info('Invalidated heartbeat interval');
    }
  };

  /**
   * Internal handler for handling a new WebSocket message. Parses data payload and fires callback.
   * @param {MessageEvent} e
   * @private
   */
  _handleMessage = (e: MessageEvent) => {
    // If this is a pong, ignore.
    if (e.data && e.data === 'X') {
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
        log.error('Message data was not of string type');
      }
    } catch (e) {
      log.error('Unable to parse websocket message');
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
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = null;
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

    // Reset state
    this._reset();

    // Initiate retry procedure

    this._retryConnection();

    // Fire callback
    if (this.connectionLossHandler) {
      this.connectionLossHandler(e.code, e.reason);
    }
  };

  /**
   * WebSocket error handler. Logs warning, but does nothing else. (Close handler will deal with error resolution.)
   * @private
   */
  _handleSocketError = () => {
    // NOTE: onError event is not provided with any information, onClose must deal with causeality.
    // This is simply a notification.
    log.warn('A websocket error occurred.');
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
    this.heartbeatInterval = setInterval(() => {
      if (!this.socket) {
        log.warn('Trying to send heartbeat, but no socket connection exists.');
        return;
      }
      this.socket.send('X');
    }, this.options.heartbeatFrequency);
  };
}

// Export singleton instance of QuiqSocket
export default new QuiqSocket();

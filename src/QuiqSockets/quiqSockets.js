// @flow
import StatusCodes from 'StatusCodes';
import log from 'logging';
import {clamp} from 'lodash';

class QuiqSocket {
  url: ?string;
  connectionLossHandler: ?(reasonCode: number, message: string) => any;
  connectionEstablishHandler: ?() => any;
  socket: ?WebSocket;
  intentionalClose: boolean = false;
  options: {[string]: any} = {
    maxRetriesOnConnectionLoss: 10,
    backoffFunction: (attempt: number) => clamp((attempt ** 2 - 1) / 2 * 1000, 0, 30000),
    maxFailuresPerConnection: 100,
    connectionAttemptTimeout: 10000,
  };

  constructor() {
    if (!window.WebSocket) {
      throw new Error('This browser does not support websockets');
    }
  }

  withURL(url: string): QuiqSocket {
    this.url = url;
    return this;
  }

  onConnectionLoss(f: (reasonCode: number, message: string) => any): QuiqSocket {
    this.connectionLossHandler = f;
    return this;
  }

  onConnectionEstablish(f: () => any): QuiqSocket {
    this.connectionEstablishHandler = f;
    return this;
  }

  connect(): QuiqSocket {
    log.info('Connecting socket...');

    if (!this.url) {
      throw new Error('QuiqSocket: A URL must be provided before connecting.');
    }

    const makeConnection = () => {};

    // Cl;ose existing connection
    if (this.socket) {
      log.info('Closing existing connection');
      this.socket.onclose = makeConnection;
      this.socket.close(StatusCodes.closeNormal, 'Closing and reconnecting');
    }

    this.socket = new WebSocket(this.url);

    this.socket.onopen = this._handleOpen;
    this.socket.onclose = this._handleClose;
    this.socket.onerror = this._handleError;

    return this;
  }

  close(): QuiqSocket {
    log.info('Closing socket intentionally');
    this.intentionalClose = true;
    this.socket.close(StatusCodes.closeNormal, 'Client-initiated, intentional close.');

    this.socket = null;
    return this;
  }

  /********************************
   * Private Members
   *******************************/

  _handleOpen() {
    log.info(`Socket opened to ${this.socket.url}`);
    if (this.connectionEstablishHandler) {
      this.connectionEstablishHandler();
    }
  }

  _handleClose(e: CloseEvent) {
    const dirtyOrClean = e.wasClean ? 'CLEANLY' : 'DIRTILY';
    log.info(`Socket ${dirtyOrClean} closed with code ${e.code}: ${e.reason}`);

    // If this close was not intentional, handle error
    if (this.connectionLossHandler) {
      this.connectionLossHandler();
    }
  }

  _handleError() {
    // NOTE: onError event is not provided with any information, onClose must deal with causeality.
    // This is simply a notification.
    log.debug('A websocket error occurred.');
  }
}

export default new QuiqSocket();

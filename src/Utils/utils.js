// @flow
import {UAParser} from 'ua-parser-js';
import {setBurned} from 'globals';
import QuiqSocket from 'QuiqSockets/quiqSockets';
import {disconnectSocket} from 'websockets';
import qs from 'qs';
import logger from 'logging';
import type {BrowserNames, BurnItDownResponse} from 'types';

const log = logger('Utils');

export const formatQueryParams = (url: string, params: Object): string => {
  if (url.includes('?')) {
    const splitUrl = url.split('?');
    return `${splitUrl[0]}?${qs.stringify(Object.assign({}, qs.parse(splitUrl[1]), params))}`;
  }

  return `${url}?${qs.stringify(params)}`;
};

const parser = new UAParser();
export const getBrowserName = (): BrowserNames => parser.getResult().browser.name;
export const getMajor = (): number => parseInt(parser.getResult().browser.major, 10);

export const sortByTimestamp = (arr: Array<Object>): Array<Object> =>
  arr.slice().sort((a, b) => a.timestamp - b.timestamp);

let _onBurn: () => void;
export const registerOnBurnCallback = (onBurn: () => void) => {
  _onBurn = onBurn;
};
export const burnItDown = (message?: BurnItDownResponse) => {
  try {
    let timeToBurnItDown =
      message && !message.force && message.before ? message.before - new Date().getTime() : 0;
    if (timeToBurnItDown < 0) {
      timeToBurnItDown = 0;
    }

    setTimeout(() => {
      setBurned();
      QuiqSocket.disconnect();
      disconnectSocket();

      if (_onBurn) _onBurn();
      log.error('Webchat has been burned down.');
    }, timeToBurnItDown);
  } catch (e) {
    // Just in case something goes wrong while burning...
    // as a last ditch effort ensure we at least set burned status.
    setBurned();
    log.error(`Error encountered while burning it down: ${e.message}`);
  }
};

export const inLocalDevelopment = () =>
  !!window.location.hostname.match(/.*\.(centricient|quiq)\.dev/g);

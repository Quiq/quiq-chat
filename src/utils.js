// @flow
import {UAParser} from 'ua-parser-js';
import {setBurned} from './globals';
import QuiqSocket from './QuiqSockets/quiqSockets';
import {disconnectSocket} from './websockets';
import qs from 'qs';
import logger from './logging';
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
const getBrowserName = (): BrowserNames => parser.getResult().browser.name;
const getMajor = (): number => parseInt(parser.getResult().browser.major, 10);

export const isIE9 = () => getBrowserName() === 'IE' && getMajor() <= 9;

export const burnItDown = (message?: BurnItDownResponse) => {
  let timeToBurnItDown =
    message && !message.force && message.before ? message.before - new Date().getTime() : 0;
  if (timeToBurnItDown < 0) {
    timeToBurnItDown = 0;
  }

  setTimeout(() => {
    log.error('Webchat has been burned down.');
    setBurned();

    // Disconnect quiqSocket
    QuiqSocket.disconnect();

    // Disconnect atmosphere
    disconnectSocket();
  }, timeToBurnItDown);
};

export const sortByTimestamp = (arr: Array<Object>): Array<Object> =>
  arr.slice().sort((a, b) => a.timestamp - b.timestamp);

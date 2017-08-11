// @flow
import {UAParser} from 'ua-parser-js';
import {unsubscribe} from './index';
import {setBurned} from './globals';
import qs from 'qs';
import type {BrowserNames, BurnItDownResponse} from 'types';

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
    setBurned();
    unsubscribe();
  }, timeToBurnItDown);
};

export const sortByTimestamp = (arr: Array<Object>): Array<Object> =>
  arr.slice().sort((a, b) => a.timestamp - b.timestamp);

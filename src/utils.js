// @flow
import {UAParser} from 'ua-parser-js';
import {unsubscribe} from './index';
import {setBurned} from './globals';
import type {BrowserNames, BurnItDownResponse} from 'types';

/**
 * Formats the params object as query params in the url
 */
export const formatQueryParams = (url: string, params: Object): string => {
  const paramStrings = [];

  if (!params) {
    return url;
  }

  Object.keys(params).forEach(function(key) {
    const value = params[key];

    // If it's an array, we need to push once for each item
    if (Array.isArray(value)) {
      paramStrings.push(...value.map(v => `${key}=${v}`));
    } else if (value !== undefined) {
      paramStrings.push(`${key}=${value}`);
    }
  });

  if (paramStrings.length === 0) {
    return url;
  }

  return `${url}?${paramStrings.join('&')}`;
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
    unsubscribe();
    setBurned();
  }, timeToBurnItDown);
};

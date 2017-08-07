// @flow
import {set, get} from 'js-cookie';

export const setQuiqChatContainerVisibleCookie = (visible: boolean) => {
  set('quiq-chat-container-visible', visible, {expires: 1});
};
export const setQuiqUserTakenMeaningfulActionCookie = (visible: boolean) => {
  set('quiq-user-taken-meaningful-action', visible, {expires: 1});
};
export const setAccessToken = (token: string) => {
  set('X-Quiq-Access-Token', token, {expires: 365});
};

export const getQuiqChatContainerVisibleCookie = () =>
  get('quiq-chat-container-visible') === 'true';
export const getQuiqUserTakenMeaningfulActionCookie = () =>
  get('quiq-user-taken-meaningful-action') === 'true';
export const getAccessToken = () => get('X-Quiq-Access-Token');

export const cookiesEnabled = () => {
  set('quiq-cookies-enabled', 'true', 1);
  return get('quiq-cookies-enabled') === 'true';
};

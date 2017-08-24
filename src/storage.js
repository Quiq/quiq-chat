// @flow
import store from 'store/dist/store.modern.min';
import expirePlugin from 'store/plugins/expire';
import {get as getCookie, set as setCookie, remove as removeCookie} from 'js-cookie';

store.addPlugin(expirePlugin);

const expireInDays = (numberOfDays: number) =>
  new Date().getTime() + numberOfDays * 1000 * 60 * 60 * 24;

const expireInMinutes = (numberOfMinutes: number) =>
  new Date().getTime() + numberOfMinutes * 1000 * 60;

export const setQuiqChatContainerVisible = (visible: boolean) => {
  store.set('quiq-chat-container-visible', visible, expireInDays(1));
};
export const setQuiqUserTakenMeaningfulAction = (visible: boolean) => {
  store.set('quiq-user-taken-meaningful-action', visible, expireInDays(1));
};
export const setAccessToken = (token: string) => {
  store.set('X-Quiq-Access-Token', token, expireInDays(365));
};
export const setTrackingId = (trackingId?: string) => {
  store.set('quiq-tracking-id', trackingId, expireInMinutes(60));
};

export const getQuiqChatContainerVisible = () => store.get('quiq-chat-container-visible') === true;
export const getQuiqUserTakenMeaningfulAction = () =>
  store.get('quiq-user-taken-meaningful-action') === true;
export const getAccessToken = () => store.get('X-Quiq-Access-Token');
export const getTrackingId = () => store.get('quiq-tracking-id');
export const isStorageEnabled = () => store.enabled;

let persistentStorageEnabled;
export const isPersistentStorageEnabled = () => {
  if (typeof persistentStorageEnabled !== 'undefined') return persistentStorageEnabled;

  const cookiesEnabled = () => {
    setCookie('quiq-storage-test', 'true', 1);
    const areCookiesEnabled = getCookie('quiq-storage-test') === 'true';
    removeCookie('quiq-storage-test');
    return areCookiesEnabled;
  };

  const localStorageEnabled = () => {
    try {
      localStorage.setItem('quiq-storage-test', 'enabled?');
      localStorage.removeItem('quiq-storage-test');
    } catch (e) {
      return false;
    }

    return true;
  };

  persistentStorageEnabled = cookiesEnabled() || localStorageEnabled();
  return persistentStorageEnabled;
};

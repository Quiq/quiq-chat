// @flow
import store from 'store/dist/store.modern.min';
import expirePlugin from 'store/plugins/expire';
import modifiedTimestampPlugin from './modifiedTimestampPlugin';
import contactPointNamespacePlugin from './contactPointNamespacePlugin';
import jwt_decode from 'jwt-decode';

// NOTE: These plugins must be applied in exactly this order, to ensure that contact point namespacing
// works for the expiration and modification plugins as well.
store.addPlugin(expirePlugin);
store.addPlugin(modifiedTimestampPlugin);
store.addPlugin(contactPointNamespacePlugin);

const expireInDays = (numberOfDays: number) =>
  new Date().getTime() + numberOfDays * 1000 * 60 * 60 * 24;

export const setQuiqChatContainerVisible = (visible: boolean) => {
  store.set('quiq-chat-container-visible', visible, expireInDays(1));
};
export const setQuiqUserIsSubscribed = (visible: boolean) => {
  store.set('quiq-user-subscribed', visible, expireInDays(365));
};
export const setAccessToken = (token: string) => {
  store.set('X-Quiq-Access-Token', token, expireInDays(365));
};
export const getQuiqChatContainerVisible = () => store.get('quiq-chat-container-visible') === true;
export const getQuiqUserTakenMeaningfulAction = () =>
  store.get('quiq-user-taken-meaningful-action') === true;
export const getQuiqUserIsSubscribed = () => store.get('quiq-user-subscribed') === true;
export const getAccessToken = () => store.get('X-Quiq-Access-Token');
export const getTrackingId = () => {
  const accessToken = getAccessToken();

  if (accessToken && accessToken !== null) {
    const accessJwt = jwt_decode(accessToken);
    return accessJwt.sub;
  }

  return null;
};

let storageEnabled;
export const isStorageEnabled = () => {
  if (typeof storageEnabled !== 'undefined') return storageEnabled;

  const storageKey = 'quiq-storage-test';
  const storageVal = 'enabled?';
  try {
    localStorage.setItem(storageKey, storageVal);
    if (localStorage.getItem(storageKey) !== storageVal) {
      storageEnabled = false;
    }
    localStorage.removeItem(storageKey);
    storageEnabled = true;
  } catch (e) {
    storageEnabled = false;
  }

  return storageEnabled;
};

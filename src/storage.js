// @flow
import store from 'store/dist/store.modern.min';
import expirePlugin from 'store/plugins/expire';

// Store.js plugin to store timestamps whenever a key is modified
// NOTE: Do not add 'const' before this function, it must not be lexically bound to work with store.js
function modifiedTimestampPlugin() {
  const namespace = 'modified_timestamp_mixin';
  const modifiedTimestampStore = this.createStore(
    this.storage,
    null,
    this._namespacePrefix + namespace,
  );
  return {
    set: (superFunc, key) => {
      modifiedTimestampStore.set(key, Date.now());
      return superFunc();
    },
  };
}

store.addPlugin(expirePlugin);
store.addPlugin(modifiedTimestampPlugin);

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

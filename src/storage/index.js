// @flow
import store from 'store/dist/store.modern.min';
import expirePlugin from 'store/plugins/expire';
import modifiedTimestampPlugin from './modifiedTimestampPlugin';
import contactPointNamespacePlugin from './contactPointNamespacePlugin';
import logger from '../logging';
import jwt_decode from 'jwt-decode';
import type {PersistentData} from 'types';

type StorageCallbacks = {
  onPersistentDataChange?: (data: PersistentData) => void,
};

const log = logger('Storage');

// NOTE: These plugins must be applied in exactly this order, to ensure that contact point namespacing
// works for the expiration and modification plugins as well.
store.addPlugin(expirePlugin);
store.addPlugin(modifiedTimestampPlugin);
store.addPlugin(contactPointNamespacePlugin);

const key = 'quiq-data';
const ttl = 365;
let callbacks: StorageCallbacks = {};

const expireInDays = (numberOfDays: number) =>
  new Date().getTime() + numberOfDays * 1000 * 60 * 60 * 24;

const processLegacyKeys = () => {
  const legacyKeys = [
    'X-Quiq-Access-Token',
    'quiq-chat-container-visible',
    'quiq-tracking-id',
    'quiq-user-taken-meaningful-action',
    'quiq-user-subscribed',
    'quiq_mute_sounds',
  ];

  const quiqData = {};
  legacyKeys.forEach(k => {
    const value = store.get(k);
    if (value) {
      quiqData[k] = value;
      store.remove(k);
    }
  });

  store.set(key, quiqData, expireInDays(ttl));
};

export const init = () => {
  if (!store.get(key)) {
    log.info('Processing legacy local storage keys into quiq-data');
    processLegacyKeys();
  }
};

export const getData = (): PersistentData => store.get(key) || {};

export const updateData = (newData: PersistentData) => {
  const currentData = getData();
  const mergedData = Object.assign({}, currentData, newData);
  store.set(key, mergedData, expireInDays(ttl));

  if (callbacks.onPersistentDataChange) {
    callbacks.onPersistentDataChange(mergedData);
  }
};

export const registerCallbacks = (newCallbacks: StorageCallbacks) => {
  callbacks = Object.assign({}, callbacks, newCallbacks);
};

export const setQuiqChatContainerVisible = (chatContainerVisible: boolean) => {
  updateData({chatContainerVisible});
};

export const setQuiqUserIsSubscribed = (subscribed: boolean) => {
  updateData({subscribed});
};

export const setAccessToken = (accessToken: string) => {
  updateData({accessToken});
};

export const getQuiqChatContainerVisible = () => getData().chatContainerVisible === true;

export const getQuiqUserTakenMeaningfulAction = () => getData().hasTakenMeaningfulAction === true;

export const getQuiqUserIsSubscribed = () => getData().subscribed === true;

export const getAccessToken = () => getData().accessToken;

export const getTrackingId = () => {
  const accessToken = getAccessToken();

  if (accessToken && accessToken !== null) {
    const accessJwt = jwt_decode(accessToken);
    return accessJwt.sub;
  }

  return null;
};

export const setCustomPersistentData = (key: string, value: any) => updateData({[key]: value});

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

import store from 'store/dist/store.modern.min';
import expirePlugin from 'store/plugins/expire';
import modifiedTimestampPlugin from './modifiedTimestampPlugin';
import contactPointNamespacePlugin from './contactPointNamespacePlugin';
import { PersistentData } from '../types';

type StorageCallbacks = {
  onPersistentDataChange?: (data: PersistentData) => void;
};

// NOTE: These plugins must be applied in exactly this order, to ensure that contact point namespacing
// works for the expiration and modification plugins as well.
store.addPlugin(expirePlugin);
store.addPlugin(modifiedTimestampPlugin);
store.addPlugin(contactPointNamespacePlugin);

const prefix = 'quiq-data';
const ttl = 365;
let callbacks: StorageCallbacks = {};

const expireInDays = (numberOfDays: number) =>
  new Date().getTime() + numberOfDays * 1000 * 60 * 60 * 24;

const getData = (): PersistentData => store.get(prefix) || {};

export const get = (key: string): any => (store.get(prefix) || {})[key];

export const set = (key: string, value: any) => {
  const currentData = getData();
  const mergedData = Object.assign({}, currentData, { [key]: value });

  // @ts-ignore we've extended the StoreJs API to allow for expiration time
  store.set(prefix, mergedData, expireInDays(ttl));

  if (callbacks.onPersistentDataChange) {
    callbacks.onPersistentDataChange(mergedData);
  }
};

export const registerCallbacks = (newCallbacks: StorageCallbacks) => {
  callbacks = Object.assign({}, callbacks, newCallbacks);
};

let storageEnabled: boolean | undefined;
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

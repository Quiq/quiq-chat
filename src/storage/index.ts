import engine from 'store/src/store-engine';
import sessionStore from 'store/storages/sessionStorage';
import localStore from 'store/storages/localStorage';
import expirePlugin from 'store/plugins/expire';
import modifiedTimestampPlugin from './modifiedTimestampPlugin';
import contactPointNamespacePlugin from './contactPointNamespacePlugin';
import logging from '../logging';
import {PersistentData} from '../types';
import * as Utils from './utils';

type StorageCallbacks = {
    onPersistentDataChange?: (data: PersistentData) => void;
};

export interface PersistedData {
    data: {[key: string]: any},
    lastModifiedTimestamp: number,
    expiration: number,
}

export enum StorageMode {
    LOCAL = 'local',
    SESSION = 'session',
}

const storages: { [mode in StorageMode]: any } = {
    [StorageMode.LOCAL]: localStore,
    [StorageMode.SESSION]: sessionStore,
};

const log = logging('Storage');

let storageEnabled: boolean | undefined;

// @ts-ignore
let store: StoreJsAPI = {
    get: () => {
        throw new Error('Storage not initialized!')
    },
    set: () => {
        throw new Error('Storage not initialized!')
    },
};

const prefix = 'quiq-data';
const ttl = 365;
let callbacks: StorageCallbacks = {};

const expireInDays = (numberOfDays: number) =>
    new Date().getTime() + numberOfDays * 1000 * 60 * 60 * 24;


/***** Storage Interface *******/
export const getAll = (): PersistentData => store.get(prefix) || {};

export const get = (key: string): any => (store.get(prefix) || {})[key];

export const set = (key: string, value: any) => {
    const currentData = getAll();
    const mergedData = Object.assign({}, currentData, {[key]: value});

    // @ts-ignore we've extended the StoreJs API to allow for expiration time
    store.set(prefix, mergedData, expireInDays(ttl));

    if (callbacks.onPersistentDataChange) {
        callbacks.onPersistentDataChange(mergedData);
    }
};

export const registerCallbacks = (newCallbacks: StorageCallbacks) => {
    callbacks = Object.assign({}, callbacks, newCallbacks);
};

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

// Initial persisted data is a complete storage snapshot, complete with expiration and last modified timestamp 
// fields. For each kay in the provided data, **IFF** the provided data is NEWER than the currently persisted data,
// or they key does not exist in currently persisted data, the provided key will REPLACE the persisted key.
export const initialize = (mode: StorageMode, contactPoint: string, initialPersistedData?: PersistedData) => {
    log.info(`Utilizing ${mode} storage mechanism`);
    
    // NOTE: These plugins must be applied in exactly this order, to ensure that contact point namespacing
    // works for the expiration and modification plugins as well.
    const plugins = [expirePlugin, modifiedTimestampPlugin, contactPointNamespacePlugin(contactPoint)];
    
    // We have to search for our data in all storages and migrate it to the intended storage mechanism.
    // This allows switching back and forth between mechanisms without disrupting active chats.
    
    // We never want to have quiq data in multiple storage mechanisms. If you're going to migrate data, 
    // remove it from the source and place it in the destination.
    let existingData;
    let existingModifiedTimestamp;
    let existingExpiration;
    let mechanism: StorageMode;
    // Since we only have data in one place at a time, we only need to find the FIRST mechanism with quiq data
    for (mechanism of Object.values(StorageMode)) {
        const tempStore = engine.createStore(storages[mechanism], plugins);
        existingData = tempStore.get(prefix);
        
        // If we found data and this is NOT the intended mechanism, copy and delete, then bail out
        if (existingData && mechanism !== mode) {
            // @ts-ignore we've extended the StoreJs API to allow for getting the last modified timestamp
            existingModifiedTimestamp = tempStore.getLastModifiedTimestamp(prefix);
            // @ts-ignore we've extended the StoreJs API to allow for getting the expiration
            existingExpiration = tempStore.getExpiration(prefix);
            tempStore.remove(prefix);
            break;
        }
    }
    
    // Create storage engine in intended mechanism
    store = engine.createStore([storages[mode]], plugins);
    
    // Insert existing data from other store into intended store if any was found
    // @ts-ignore
    if (existingData && mechanism !== mode) {
        // @ts-ignore
        log.info(`Transferring persisted state from ${mechanism} to ${mode}`);
        // @ts-ignore we've extended the StoreJs API to allow for expiration time
        store.set(prefix, existingData, existingExpiration);
        // @ts-ignore we've extended the StoreJs API to allow for setting the last modified timestamp
        store.setLastModifiedTimestamp(prefix, existingModifiedTimestamp);
    } 
    
    // Update the persisted data with the provided initial data if it's newer than what's persisted
    if (initialPersistedData) {
        Utils.updatePersistedItemIfNewer(initialPersistedData, prefix, store);
    }
};
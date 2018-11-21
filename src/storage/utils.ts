import {PersistedData} from ".";
import Logging from '../logging';

const log = Logging('StorageUtils');

export const updatePersistedItemIfNewer = (newData: PersistedData, key: string, store: StoreJsAPI) => {
    // @ts-ignore
    const existingModifiedTime = store.getLastModifiedTimestamp(key);
    
    // Write data to storage only if 1) the key does not currently exist or 2) the existing key was modified earlier than the new key
    if (!store.get(key) || newData.lastModifiedTimestamp > existingModifiedTime) {
        log.info('Replacing existing persisted data ()if it existed) with provided initial persisted data');
        // @ts-ignore we've extended the StoreJs API to allow for expiration time
        store.set(key, newData.data, newData.expiration);
        // @ts-ignore we've extended the StoreJs API to allow for setting last modified timestamp
        store.setLastModifiedTimestamp(key, newData.lastModifiedTimestamp);
    }
};
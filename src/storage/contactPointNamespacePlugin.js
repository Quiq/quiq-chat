import {getContactPoint} from '../globals';
import logger from '../logging';

const log = logger('Store Namespace Plugin');

// Store.js plugin to automatically namespace keys by contact point
// NOTE: Do not use arrow notation with this function, it must not be lexically bound to work with store.js
function contactPointNamespacePlugin() {
  const get = (superFunc, key) => {
    const ns = getContactPoint();
    if (!ns) return null;
    const namespacedValue = superFunc(`${key}_${ns}`);
    if (namespacedValue) return namespacedValue;

    // For backwards compatibility, if namespaced key wasn't found, try generic key.
    const genericValue = superFunc(key);
    if (genericValue) {
      // Delete this generic key and update to be namespaced
      this.set(key, genericValue);
      this.remove(key);
    }
    return genericValue;
  };

  const set = (superFunc, key, value) => {
    const ns = getContactPoint();
    if (!ns) {
      log.error(`Can't set key ${key} before global QuiqChatOptions have been set.`);
      return;
    }
    return superFunc(`${key}_${ns}`, value);
  };

  return {get, set};
}

export default contactPointNamespacePlugin;

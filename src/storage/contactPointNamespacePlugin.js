import {getContactPoint} from '../globals';
import logger from '../logging';

const log = logger('Store Namespace Plugin');

// Store.js plugin to automatically namespace keys by contact point
// NOTE: Do not use arrow notation with this function, it must not be lexically bound to work with store.js
function contactPointNamespacePlugin() {
  const get = (superFunc, key) => {
    const ns = getContactPoint();
    if (!ns) return null;
    return superFunc(`${key}_${ns}`);
  };

  const set = (superFunc, key, value) => {
    const ns = getContactPoint();
    if (!ns) {
      log.error(`Can't set key ${key} before global QuiqChatOptions have been set.`);
      return;
    }
    return superFunc(`${key}_${ns}`, value);
  };

  const remove = (superFunc, key) => {
    const ns = getContactPoint();
    if (!ns) {
      log.error(`Can't set key ${key} before global QuiqChatOptions have been set.`);
      return;
    }
    return superFunc(`${key}_${ns}`);
  };

  return {get, set, remove};
}

export default contactPointNamespacePlugin;

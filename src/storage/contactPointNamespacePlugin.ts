import logger from '../logging';

const log = logger('Store Namespace Plugin');

// Store.js plugin to automatically namespace keys by contact point
// NOTE: Do not use arrow notation with this function, it must not be lexically bound to work with store.js
function contactPointNamespacePlugin(namespace: string) {
  return function() {
    const get = (superFunc: Function, key: string) => {
      const namespacedValue = superFunc(`${key}_${namespace}`);
      if (namespacedValue) return namespacedValue;

      // For backwards compatibility, if namespaced key wasn't found, try generic key.
      const genericValue = superFunc(key);
      if (genericValue) {
        // Delete this generic key and update to be namespaced
        this.remove(key, false);
        this.set(key, genericValue);
      }
      return genericValue;
    };

    const set = (superFunc: Function, key: string, value: any) => {
      if (!namespace) {
        log.error(`Can't set key ${key} before QuiqChatClient has been initialized.`, {
          logOptions: {
            frequency: 'history',
            logFirstOccurrence: true,
          },
        });
        return;
      }
      return superFunc(`${key}_${namespace}`, value);
    };

    const remove = (superFunc: Function, key: string, useContactPointNamespace = true) => {
      if (!namespace && useContactPointNamespace) {
        log.error(`Can't remove key ${key} before QuiqChatClient has been initialized.`, {
          logOptions: {
            frequency: 'history',
            logFirstOccurrence: true,
          },
        });
        return;
      }
      const postfix = useContactPointNamespace ? `_${namespace}` : '';
      const modKey = `${key}${postfix}`;
      return superFunc(modKey);
    };

    // We also need to namespace calls to get/set last modified timestamp (from lastModified plugin), but these
    // can be proxied through the same method used for main get and set.
    return { get, set, remove, getLastModifiedTimestamp: get, setLastModifiedTimestamp: set };
  };
}

export default contactPointNamespacePlugin;

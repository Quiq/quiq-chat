import logger from '../logging';
import ChatState from '../State';

const log = logger('Store Namespace Plugin');

// Store.js plugin to automatically namespace keys by contact point
// NOTE: Do not use arrow notation with this function, it must not be lexically bound to work with store.js
function contactPointNamespacePlugin() {
  const get = (superFunc: Function, key: string) => {
    const ns = ChatState.contactPoint;
    if (!ns) return null;
    const namespacedValue = superFunc(`${key}_${ns}`);
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
    const ns = ChatState.contactPoint;
    if (!ns) {
      log.error(`Can't set key ${key} before QuiqChatClient has been initialized.`, {logOptions: {frequency: 'history', logFirstOccurrence: true}});
      return;
    }
    return superFunc(`${key}_${ns}`, value);
  };

  const remove = (superFunc: Function, key: string, useContactPointNamespace = true) => {
    const ns = ChatState.contactPoint;
    if (!ns && useContactPointNamespace) {
        log.error(`Can't remove key ${key} before QuiqChatClient has been initialized.`, {logOptions: {frequency: 'history', logFirstOccurrence: true}});
      return;
    }
    const postfix = useContactPointNamespace ? `_${ns}` : '';
    const modKey = `${key}${postfix}`;
    return superFunc(modKey);
  };

  return { get, set, remove };
}

export default contactPointNamespacePlugin;

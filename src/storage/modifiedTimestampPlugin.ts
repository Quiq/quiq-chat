// Store.js plugin to store a timestamp of when a key was last modified
// NOTE: Do not use arrow notation with this function, it must not be lexically bound to work with store.js
function modifiedTimestampPlugin() {
  const namespace = 'modified_timestamp_mixin';
  const modifiedTimestampStore = this.createStore(
    this.storage,
    null,
    this._namespacePrefix + namespace,
  );

  const set = (superFunc: Function, key: string) => {
    modifiedTimestampStore.set(key, Date.now());
    return superFunc();
  };

  const remove = (superFunc: Function, key: string) => {
    modifiedTimestampStore.remove(key);
    return superFunc(key);
  };

  return { set, remove };
}

export default modifiedTimestampPlugin;

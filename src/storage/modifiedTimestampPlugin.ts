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

  const getLastModifiedTimestamp = (_: Function, key: string) => modifiedTimestampStore.get(key);

  const setLastModifiedTimestamp = (_: Function, key: string, timestamp: number) =>
    modifiedTimestampStore.set(key, timestamp);

  return { set, remove, getLastModifiedTimestamp, setLastModifiedTimestamp };
}

export default modifiedTimestampPlugin;

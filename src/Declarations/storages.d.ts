/**
 * The @types/storejs module contains most store typings, but it does not include
 * the stroage mechanism types.
 */

declare const StorageMechanism: any;

declare module 'store/storages/sessionStorage' {
  export = StorageMechanism;
}

declare module 'store/storages/localStorage' {
  export = StorageMechanism;
}

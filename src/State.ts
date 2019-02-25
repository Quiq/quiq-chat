import logger from './logging';
import * as Storage from './storage';
import isEqual from 'lodash/isEqual';
import { QuiqChatState } from './types';

interface ChangeHandler {
  handler: (newValue: any, oldValue: any) => void;
  ignoreInitialDefinition: boolean;
}

const log = logger('State');

const state: { [key: string]: any } = {};
const stateAccessors: QuiqChatState = {};
const listeners: { [key: string]: Array<ChangeHandler> } = {};

export const addStateField = <K extends keyof QuiqChatState>(
  key: K,
  persisted: boolean = false,
  defaultValue?: QuiqChatState[K],
  deepEquality: boolean = false,
) => {
  if (stateAccessors.hasOwnProperty(key)) {
    log.error(`A key already exists with name ${key}`, {
      logOptions: { frequency: 'history', logFirstOccurrence: true },
    });
    return;
  }

  state[key] = undefined;

  listeners[key] = [];

  Object.defineProperty(stateAccessors, key, {
    // tslint:disable-next-line object-literal-shorthand
    get: function() {
      if (!state.hasOwnProperty(key)) {
        log.error(`Cannot access unknown state field ${key}`, {
          logOptions: { frequency: 'history', logFirstOccurrence: true },
        });
      }

      // If this is the first time accessing a persisted key, load from localStorage
      if (typeof state[key] === 'undefined' && persisted) {
        state[key] = Storage.get(key);
      }

      return state[key];
    },

    // tslint:disable-next-line object-literal-shorthand
    set: function(value) {
      const oldValue = state[key];
      state[key] = value;
      if (persisted) {
        Storage.set(key, value);
      }
      if (deepEquality ? !isEqual(value, oldValue) : value !== oldValue) {
        listeners[key].forEach(listener => {
          if (!listener.ignoreInitialDefinition || oldValue !== undefined) {
            listener.handler(value, oldValue);
          }
        });
      }
    },
    configurable: true,
    enumerable: true,
  });

  // Assign default value if not assigned
  if (defaultValue && typeof stateAccessors[key] === 'undefined') {
    stateAccessors[key] = defaultValue;
  }
};

export const watch = <K extends keyof QuiqChatState>(
  key: K,
  handler: (newValue: QuiqChatState[K], oldValue: QuiqChatState[K]) => void,
  ignoreInitialDefinition: boolean = true,
) => {
  if (!state.hasOwnProperty(key)) {
    log.error(`Cannot add watch for unknown key ${key}`, {
      logOptions: { frequency: 'history', logFirstOccurrence: true },
    });
    return;
  }

  if (!listeners[key].some(l => l.handler === handler)) {
    listeners[key].push({ handler, ignoreInitialDefinition });
  }
};

export const reset = () => {
  Object.getOwnPropertyNames(state).forEach(key => {
    // Clear watch functions first, so they don't detect changes to undefined in state
    listeners[key] = [];
    state[key] = undefined;
  });
};

export const initialize = () => {
  addStateField('accessToken', true);
  addStateField('subscribed', true);
  addStateField('chatIsVisible', true);
  addStateField('hasTakenMeaningfulAction', true);
  addStateField('customPersistedData', true);
  addStateField('trackingId');
  addStateField('agentIsAssigned');
  addStateField('userIsRegistered');
  addStateField('connected', false, false);
  addStateField('reconnecting', false, false);
  addStateField('estimatedWaitTime');
  addStateField('contactPoint', false, 'default');
  addStateField('burned');
  addStateField('host');
  addStateField('configuration');
  addStateField('context', false, {});
  addStateField('transcript', false, undefined, true);
};

// This is used only by tests. It completely nukes everything and allows re-initialization.
// In real code, use `reset()`
export const _deinit = () => {
  for (const key of Object.keys(state)) {
    delete state[key];
  }
  for (const key of Object.keys(stateAccessors)) {
    // @ts-ignore
    delete stateAccessors[key];
  }
  for (const key of Object.keys(listeners)) {
    delete listeners[key];
  }
};

export default stateAccessors;

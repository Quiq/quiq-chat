import logger from './logging';
import * as Storage from './storage';
import {QuiqChatState} from './types';

const log = logger('State');

const state: { [key: string]: any } = {};
const stateAccessors: QuiqChatState = {};
const listeners: { [key: string]: Array<(newValue: any, oldValue: any) => void> } = {};

export const addStateField = <K extends keyof QuiqChatState>(key: K,
                                                             persisted: boolean = false,
                                                             defaultValue?: QuiqChatState[K],) => {
    if (stateAccessors.hasOwnProperty(key)) {
        log.error(`A key already exists with name ${key}`);
        return;
    }

    state[key] = undefined;

    listeners[key] = [];

    Object.defineProperty(stateAccessors, key, {
        // tslint:disable-next-line object-literal-shorthand
        get: function () {
            if (!state.hasOwnProperty(key)) {
                log.error(`Cannot access unknown state field ${key}`);
            }

            // If this is the first time accessing a persisted key, load from localStorage
            if (typeof state[key] === 'undefined' && persisted) {
                state[key] = Storage.get(key);
            }

            return state[key];
        },

        // tslint:disable-next-line object-literal-shorthand
        set: function (value) {
            const oldValue = state[key];
            state[key] = value;
            if (persisted) {
                Storage.set(key, value);
            }
            if (oldValue !== value) {
                listeners[key].forEach(f => f(value, oldValue));
            }
        },
    });

    // Assign default value if not assigned
    if (defaultValue && typeof stateAccessors[key] === 'undefined') {
        stateAccessors[key] = defaultValue;
    }
};

export const watch = <K extends keyof QuiqChatState>(key: K,
                                                     f: (newValue: QuiqChatState[K], oldValue: QuiqChatState[K]) => void,) => {
    if (!state.hasOwnProperty(key)) {
        log.error(`Cannot add watch for unknown key ${key}`);
        return;
    }

    if (!listeners[key].includes(f)) {
        listeners[key].push(f);
    }
};

export const reset = () => {
    Object.getOwnPropertyNames(state).forEach(key => {
        // Clear watch functions first, so they don't detect changes to undefined in state
        listeners[key] = [];
        state[key] = undefined;
    });
};

addStateField('accessToken', true);
addStateField('subscribed', true);
addStateField('chatIsVisible', true);
addStateField('hasTakenMeaningfulAction', true);
addStateField('customPersistedData', true);
addStateField('trackingId');
addStateField('agentIsAssigned');
addStateField('userIsRegistered');
addStateField('connected');
addStateField('reconnecting');
addStateField('estimatedWaitTime');
addStateField('contactPoint', false, 'default');
addStateField('burned');
addStateField('host');

export default stateAccessors;

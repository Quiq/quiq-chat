jest.mock('../storage');
jest.mock('../logging');

import ChatState, { addStateField, initialize, watch } from '../State';
import * as _Storage from '../storage';

const storage = <any>_Storage;

describe('ChatState', () => {
  beforeAll(() => {
    initialize();
  });

  describe('initialization', () => {
    it('creates accessor for each defined property', () => {
      expect(Object.getOwnPropertyNames(ChatState).length).toBe(17);
    });
  });

  describe('addStateField', () => {
    it('adds property accessor', () => {
      // @ts-ignore
      addStateField('testField');
      expect(ChatState.hasOwnProperty('testField')).toBe(true);
      // @ts-ignore
      expect(ChatState.testField).toBeUndefined();
    });

    describe('with default value', () => {
      it('sets default', () => {
        // @ts-ignore
        addStateField('testDefaultField', false, 'testValue');
        expect(ChatState.hasOwnProperty('testDefaultField')).toBe(true);
        // @ts-ignore
        expect(ChatState.testDefaultField).toBe('testValue');
      });
    });
  });

  describe('getter', () => {
    describe('persistence', () => {
      beforeAll(() => {
        storage.get.mockReturnValue('testStoredValue');
      });

      afterAll(() => {
        jest.clearAllMocks();
      });

      it('loads stored value', () => {
        // @ts-ignore
        addStateField('testPersist', true);
        // @ts-ignore
        expect(ChatState.testPersist).toBe('testStoredValue');
      });

      describe('with default', () => {
        it("default does not override what's in storage", () => {
          // @ts-ignore
          addStateField('testPersistDefault', true, 'default');
          // @ts-ignore
          expect(ChatState.testPersistDefault).toBe('testStoredValue');
        });
      });
    });
  });

  describe('setter', () => {
    describe('watchers', () => {
      let watcher = jest.fn();

      beforeAll(() => {
        initialize();
        // @ts-ignore
        addStateField('testKey');
        // @ts-ignore
        ChatState.testKey = 'valueA';

        // @ts-ignore
        watch('testKey', watcher);
      });

      afterEach(() => {
        watcher.mockClear();
      });

      it('fires any listeners if value has changed', () => {
        ChatState.testKey = 'valueB';
        expect(watcher).toHaveBeenCalledWith('valueB', 'valueA');
      });

      describe('changing from undefined to value (setting the initial value)', () => {
        beforeAll(() => {
          addStateField('testKey2');
          watch('testKey2', watcher);
        });

        it('does not fire watcher', () => {
          ChatState.testKey2 = 'value';
          expect(watcher).not.toHaveBeenCalled();
        });
      });

      describe('when deep equality is enabled on a key', () => {
        beforeAll(() => {
          addStateField('testKey3', false, undefined, true);
          ChatState.testKey3 = { a: { b: 1 } };
          watch('testKey3', watcher);
        });

        fit('does fires watcher on deep change', () => {
          ChatState.testKey3 = { a: { b: 2 } };
          expect(watcher).toHaveBeenCalledWith({ a: { b: 2 } }, { a: { b: 1 } });
        });
      });
    });
  });
});

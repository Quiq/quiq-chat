jest.mock('../storage');
jest.mock('../logging');

import ChatState, { addStateField, initialize } from '../State';
import * as _Storage from '../storage';

const storage = <any>_Storage;

describe('ChatState', () => {
  beforeAll(() => {
    initialize();
  });

  describe('initialization', () => {
    it('creates accessor for each defined property', () => {
      expect(Object.getOwnPropertyNames(ChatState).length).toBe(16);
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
});

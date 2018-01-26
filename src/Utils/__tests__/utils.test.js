// @flow
jest.mock('globals');
jest.mock('../../logging');
import * as Utils from '../utils';
import * as Globals from 'globals';
import type {BurnItDownResponse} from 'types';

describe('Utils', () => {
  describe('formatQueryParams', function() {
    it('adds params with ? and & syntax', function() {
      expect(Utils.formatQueryParams('/url', {a: 'one', b: 'two'})).toBe('/url?a=one&b=two');
      expect(
        Utils.formatQueryParams('/url?alreadyParamed=true', {
          a: 'one',
          b: 'two',
        }),
      ).toBe('/url?alreadyParamed=true&a=one&b=two');
      expect(
        Utils.formatQueryParams('/url?alreadyParamed=true&extraParam=crazy', {
          a: 'one',
          b: 'two',
        }),
      ).toBe('/url?alreadyParamed=true&extraParam=crazy&a=one&b=two');
    });
  });

  let burnObject: BurnItDownResponse;
  describe('burnItDown', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      // $FlowIssue using mocked version of function which allows an optional argument
      Globals.setBurned(false);

      burnObject = {
        force: false,
        before: undefined,
        code: 466,
      };
    });

    it('burns it down immediately with no before', () => {
      Utils.burnItDown(burnObject);
      jest.runTimersToTime(1); // 1ms run since we call setTimeout with 0ms.
      expect(Globals.getBurned()).toBe(true);
    });

    it('burns it down after before', () => {
      burnObject.before = new Date().getTime() + 1000;
      Utils.burnItDown(burnObject);
      jest.runTimersToTime(500);
      expect(Globals.getBurned()).toBe(false);
      jest.runTimersToTime(501);
      expect(Globals.getBurned()).toBe(true);
    });

    it('burns it immediately if before is already expired', () => {
      burnObject.before = -1;
      Utils.burnItDown(burnObject);
      jest.runTimersToTime(1); // 1ms run since we call setTimeout with 0ms.
      expect(Globals.getBurned()).toBe(true);
    });

    it('calls onBurn callback if registered', () => {
      const burnCallback = jest.fn();
      Utils.registerOnBurnCallback(burnCallback);
      Utils.burnItDown(burnObject);
      jest.runTimersToTime(1); // 1ms run since we call setTimeout with 0ms.
      expect(burnCallback).toBeCalled();
    });
  });

  describe('onceAtATime', () => {
    const f = jest.fn(
      (n: number) => new Promise(resolve => setTimeout(resolve(`Seahawks ${n}`), 2000)),
    );
    const f1 = Utils.onceAtATime(f);

    afterEach(() => {
      f.mockClear();
    });

    it('only runs the fucntions once at a time', () => {
      f1();
      f1();
      f1();
      f1();
      expect(f.mock.calls.length).toBe(1);
    });

    it('only returns the result of the original call to all subsequent calls made while original is running', async () => {
      expect.assertions(4);
      const values = await Promise.all([f1(1), f1(2), f1(3)]);
      values.forEach(v => {
        expect(v).toBe('Seahawks 1');
      });
      expect(f.mock.calls.length).toBe(1);
    });

    it('invokes the function again once first invocation is completed', async () => {
      expect.assertions(7);
      let values = await Promise.all([f1(1), f1(2), f1(3)]);
      values.forEach(v => {
        expect(v).toBe('Seahawks 1');
      });

      values = await Promise.all([f1(3), f1(4), f1(5)]);
      values.forEach(v => {
        expect(v).toBe('Seahawks 3');
      });
      expect(f.mock.calls.length).toBe(2);
    });
  });
});

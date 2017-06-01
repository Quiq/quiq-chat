// @flow
import * as Utils from '../utils';

describe('Utils', () => {
  describe('something', () => {
    describe('formatQueryParams', function() {
      it('adds params with ? and & syntax', function() {
        expect(Utils.formatQueryParams('/url', {a: 'one', b: 'two'})).toBe('/url?a=one&b=two');
      });

      describe('when a param is an array', function() {
        it('adds it multiple times', function() {
          expect(Utils.formatQueryParams('/url', {a: 'one', b: ['two', 'three']})).toBe(
            '/url?a=one&b=two&b=three',
          );
        });
      });
    });
  });
});

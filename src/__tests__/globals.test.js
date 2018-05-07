// @flow

jest.mock('../logging');
jest.mock('../Utils/utils.js');

import * as Globals from '../globals';

describe('Globals module', () => {
  describe('before globals have been set', () => {
    describe('checkRequiredSettings', () => {
      it('throws an error', () => {
        expect(Globals.checkRequiredSettings).toThrowError();
      });
    });
  });

  describe('after globals have been set', () => {
    describe('checkRequiredSettings', () => {
      it('does not throw an error', () => {
        Globals.setGlobals({HOST: 'https://testhost.goquiq.com', CONTACT_POINT: 'test'});
        expect(Globals.checkRequiredSettings).not.toThrowError();
      });
    });

    describe('getContactPoint', () => {
      it('returns the contact point', () => {
        expect(Globals.getContactPoint()).toBe('test');
      });
    });

    describe('getPublicApiUrl', () => {
      it('returns the base url for the public api', () => {
        expect(Globals.getPublicApiUrl()).toMatchSnapshot();
      });
    });

    describe('getUrlForContactPoint', () => {
      it('returns the url for the api for the current contact point', () => {
        expect(Globals.getUrlForContactPoint()).toMatchSnapshot();
      });
    });
  });
});

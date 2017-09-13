import Raven from 'raven-js';
import {version} from '../package.json';
import {inLocalDevelopment} from './Utils/utils';
import {getTrackingId} from './storage';

export const init = () => {
  if (!inLocalDevelopment())
    Raven.config('https://5622397f17c44165a039d3b91d3e0193@sentry.io/170102', {
      release: version,
    }).install();

  const trackingId = getTrackingId();
  if (trackingId) {
    Raven.setUserContext({id: trackingId});
  }
};

import Raven from 'raven-js';
import {version} from '../package.json';
import {inLocalDevelopment} from './Utils/utils';

export const init = () => {
  if (!inLocalDevelopment())
    Raven.config('https://5622397f17c44165a039d3b91d3e0193@sentry.io/170102', {
      release: version,
      autoBreadcrumbs: {
        xhr: false, // XMLHttpRequest
        console: true, // console logging
        dom: true, // DOM interactions, i.e. clicks/typing
        location: true, // url changes, including pushState/popState
      },
    }).install();
};

export default init;

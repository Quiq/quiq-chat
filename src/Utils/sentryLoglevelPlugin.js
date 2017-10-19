// @flow

import Raven from 'raven-js';
import QuiqChatClient from '../index';

const sentryPlugin = {
  apply: (log: Object) => {
    const originalFactory = log.methodFactory;
    log.methodFactory = (methodName, logLevel, loggerName) => {
      const rawMethod = originalFactory(methodName, logLevel, loggerName);

      // Sentry needs 'warning' instead of 'warn'
      const level = methodName === 'warn' ? 'warning' : methodName;

      switch (level) {
        case 'error':
        case 'warning':
          return errorLogger(rawMethod, level, loggerName);

        default:
          return infoLogger(rawMethod, level, loggerName);
      }
    };

    log.setLevel(log.getLevel()); // Be sure to call setLevel method in order to apply plugin
  },
};

const errorLogger = (rawMethod, level, loggerName) => (
  message,
  {data = {}, exception = null} = {},
) => {
  const extra = Object.assign({}, QuiqChatClient._getState(), data);
  if (exception) {
    Raven.captureException(exception, {
      level,
      logger: loggerName,
      extra,
    });
  } else {
    Raven.captureMessage(message, {
      level,
      logger: loggerName,
      extra,
    });
  }
  rawMethod(message);
};

const infoLogger = (rawMethod, level, loggerName) => (message, {data = {}, capture} = {}) => {
  // By default we only capture breadcrumbs for info level, but can be overridden for trace and debug.
  if (capture || level === 'info') {
    Raven.captureBreadcrumb({message, level, category: loggerName, data});
  }
  rawMethod(message);
};

export default sentryPlugin;

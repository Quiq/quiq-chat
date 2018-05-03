// @flow

import Raven from 'raven-js';
import QuiqChatClient from '../index';

const sentryPlugin = {
  apply: (log: Object) => {
    const originalFactory = log.methodFactory;
    // eslint-disable-next-line no-param-reassign
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

/**
 * Any strings added to the blacklist below will not be logged to sentry if any of the following include the string
 * 1. Message logged to sentry
 * 2. Message in exception
 * 3. Stack trace in exception
 */
const logIsBlacklisted = (message?: string, ex?: any) => {
  try {
    const blackList = ['post-robot', 'no handler found for post message'].map(m =>
      m.replace(/[^\w]/gi, '').toLowerCase(),
    );
    const userMessage = (message ? message.toString().replace(/[^\w]/gi, '') : '').toLowerCase();
    const exMessage = (ex && ex.message
      ? ex.message.toString().replace(/[^\w]/gi, '')
      : ''
    ).toLowerCase();
    const exStack = (ex && ex.stack
      ? ex.stack
          .replace(exMessage, '')
          .toString()
          .replace(/[^\w]/gi, '')
      : ''
    ).toLowerCase();

    return blackList.some(
      m => userMessage.includes(m) || exMessage.includes(m) || exStack.includes(m),
    );
  } catch (e) {
    return false;
  }
};

const errorLogger = (rawMethod, level, loggerName) => (
  message,
  {data = {}, exception = null} = {},
  shouldCapture = true,
) => {
  const extra = Object.assign({}, QuiqChatClient && QuiqChatClient._getState(), data);
  if (shouldCapture && !logIsBlacklisted(message, exception)) {
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
  }
  rawMethod(message);
};

const infoLogger = (rawMethod, level, loggerName) => (message, {data = {}, capture} = {}) => {
  // By default we only capture breadcrumbs for info level, but can be overridden for trace and debug.
  if ((capture || level === 'info') && !logIsBlacklisted(message)) {
    Raven.captureBreadcrumb({message, level, category: loggerName, data});
  }
  rawMethod(message);
};

export default sentryPlugin;

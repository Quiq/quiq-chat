import Raven from 'raven-js';
import QuiqChatClient from '../quiq-chat';

const sentryPlugin = {
  apply: (log: { methodFactory: Function; setLevel: Function; getLevel: Function }) => {
    const originalFactory = log.methodFactory;
    // eslint-disable-next-line no-param-reassign
    log.methodFactory = (methodName: string, logLevel: string, loggerName: string) => {
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

const errorLogger = (rawMethod: Function, level: string, loggerName: string) => (
  message: string,
  { data = {}, exception }: { data?: Object; exception?: Error } = {},
  shouldCapture = true,
) => {
  // @ts-ignore QuiqChatClient._getState should never be accessed by consumer, but we're allowed to access it here.
  const extra = Object.assign({}, QuiqChatClient && QuiqChatClient._getState(), data);
  if (shouldCapture) {
    if (exception) {
      // @ts-ignore we trust that valid level is passed in
      Raven.captureException(exception, {
        level,
        logger: loggerName,
        extra,
      });
    } else {
      // @ts-ignore we trust that valid level is passed i
      Raven.captureMessage(message, {
        level,
        logger: loggerName,
        extra,
      });
    }
  }
  rawMethod(message);
};

const infoLogger = (rawMethod: Function, level: string, loggerName: string) => (
  message: string,
  { data = {}, capture = false } = {},
) => {
  // By default we only capture breadcrumbs for info level, but can be overridden for trace and debug.
  if (capture || level === 'info') {
    // @ts-ignore We trust that valid level is provided
    Raven.captureBreadcrumb({ message, level, category: loggerName, data });
  }
  rawMethod(message);
};

export default sentryPlugin;

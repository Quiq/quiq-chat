// @flow

import Raven from 'raven-js';

const sentryPlugin = {
  apply: (log: Object) => {
    const originalFactory = log.methodFactory;
    log.methodFactory = (methodName, logLevel, loggerName) => {
      const rawMethod = originalFactory(methodName, logLevel, loggerName);
      return message => {
        // Sentry needs 'warning' instead of 'warn'
        const level = methodName === 'warn' ? 'warning' : methodName;
        if (methodName === 'error' || methodName === 'warn')
          Raven.captureMessage(message, {
            level,
            logger: loggerName,
          });
        else if (methodName === 'info')
          Raven.captureBreadcrumb({message, level, category: loggerName});
        rawMethod(message);
      };
    };
    log.setLevel(log.getLevel()); // Be sure to call setLevel method in order to apply plugin
  },
};

export default sentryPlugin;

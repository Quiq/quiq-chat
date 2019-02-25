export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug',
  TRACE = 'trace',
}

export interface LogData {
  exception?: Error;
  context?: { [key: string]: any };
  tags?: { [key: string]: any };
  logOptions?: {
    frequency?: 'session' | 'history' | 'every';
    sampleRate?: number;
    logFirstOccurrence?: boolean;
  };
}

export interface LogFunction {
  (message: string, level: LogLevel, data: LogData, loggerName?: string): void;
}

const listeners: Array<LogFunction> = [];

export const addListener = (f: LogFunction) => {
  // Do nothing if this function is already registered
  if (listeners.includes(f)) {
    return;
  }

  listeners.push(f);
};

export const removeListener = (f: LogFunction) => {
  const idx = listeners.findIndex(listener => listener === f);
  if (idx > -1) {
    listeners.splice(idx, 1);
  }
};

const listenerPlugin = {
  apply: (log: { methodFactory: Function; setLevel: Function; getLevel: Function }) => {
    const originalFactory = log.methodFactory;
    // eslint-disable-next-line no-param-reassign
    log.methodFactory = (methodName: LogLevel, level: number, loggerName: string) => {
      const rawMethod = originalFactory(methodName, level, loggerName);
      return (message: string, data: LogData = {}) => {
        listeners.forEach((f: LogFunction) => {
          f(message, methodName, data, loggerName);
        });

        rawMethod(message);
      };
    };
    log.setLevel(log.getLevel(), false); // Be sure to call setLevel method in order to apply plugin
  },
};

export default listenerPlugin;

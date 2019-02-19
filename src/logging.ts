import log, {Logger} from 'loglevel';
import prefix from 'loglevel-plugin-prefix';
import logListenerPlugin from './Utils/logListenerPlugin';

export enum LogLevel { trace, debug, info, warn, error, silent }

prefix.reg(log);
prefix.apply(log, {
  template: '[%t] %l QuiqChatLib (%n):',
  timestampFormatter: (date: Date) => date.toISOString(),
  levelFormatter: (level: string) => level.charAt(0).toUpperCase() + level.substr(1),
  nameFormatter: (name: string) => name || 'global',
});

logListenerPlugin.apply(log);

// Default to 'warn' level. Can override with QuiqChatClient,.setLogLevel()
log.setDefaultLevel('warn');

const logger = (name: string) => log.getLogger(name);

export const setLevel = (level: LogLevel) => {
  log.setDefaultLevel(level);
  // @ts-ignore
  Object.values(log.getLoggers()).forEach((lgr: Logger) => lgr.setLevel(level, false));
};

export default logger;

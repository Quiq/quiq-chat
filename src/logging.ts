import log from 'loglevel';
import prefix from 'loglevel-plugin-prefix';
import sentryPlugin from './Utils/sentryLoglevelPlugin';

prefix.apply(log, {
  template: '[%t] %l QuiqChatLib (%n):',
  timestampFormatter: (date: Date) => date.toISOString(),
  levelFormatter: (level: string) => level.charAt(0).toUpperCase() + level.substr(1),
  nameFormatter: (name: string) => name || 'global',
});

sentryPlugin.apply(log);

log.enableAll();

const logger = (name: string) => log.getLogger(name);

export default logger;

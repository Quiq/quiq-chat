// @flow

import log from 'loglevel';
import prefix from 'loglevel-plugin-prefix';

prefix.apply(log, {
  template: '[%t] %l QuiqChatLib (%n):',
  timestampFormatter: date => date.toISOString(),
  levelFormatter: level => level.charAt(0).toUpperCase() + level.substr(1),
  nameFormatter: name => name || 'global',
});

log.enableAll();

const logger = (name: string) => {
  return log.getLogger(name);
};

export default logger;

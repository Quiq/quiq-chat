import log from 'loglevel';
import prefix from 'loglevel-plugin-prefix';

prefix.apply(log, {
  template: '[%t] QuiqChatLib %l (%n):',
  timestampFormatter: date => date.toISOString(),
  levelFormatter: level => level.charAt(0).toUpperCase() + level.substr(1),
  nameFormatter: name => name || 'global',
});

export default log;

// @flow
import logger from 'logging';

export type SlumberPartyHandlers = {
  wake: Array<() => void>,
};

const log = logger('SlumberParty');

class SlumberParty {
  handlers: SlumberPartyHandlers = {
    wake: [],
  };

  wallClockTime: number;
  frequency = 2000;

  constructor() {
    this.wallClockTime = Date.now();

    setInterval(() => {
      // See https://stackoverflow.com/a/4080174/3961837
      const currentTime = Date.now();
      if (currentTime > this.wallClockTime + 30000) {
        // ignore small delays
        // Probably just woke up!
        log.info('Firing wake handlers');
        this._fireHandlersForEvent('wake');
      }
      this.wallClockTime = currentTime;
    }, this.frequency);
  }

  /**
   * Register a function to be fired when the computer is believed to have woken from sleep
   * @param event {string} Name of the event (wake)
   * @param f - A function of the form () => void
   */
  addEventListener = (event: string, f: () => void) => {
    if (Array.isArray(this.handlers[event]) && !this.handlers[event].includes(f)) {
      this.handlers[event].push(f);
    }
  };

  /**
   * Unregister a previously registered event handler (must be exact same reference)
   * @param event {string} Name of the event (wake)
   * @param f - A function of the form () => void
   */
  removeEventListener = (event: string, f: () => void) => {
    if (Array.isArray(this.handlers[event])) {
      const idx = this.handlers[event].indexOf(f);
      if (idx > -1) {
        this.handlers[event].splice(idx, 1);
      }
    }
  };

  _fireHandlersForEvent(event: string) {
    if (Array.isArray(this.handlers[event])) {
      this.handlers[event].forEach(f => f());
    }
  }
}

// Export as a singleton
export default new SlumberParty();

/**
 * date mocker:
 * NOTE: just by REQUIRING this package, the current date class is mocked.
 * - replace current Date class
 * - add new static method setCurrentTime()
 * - once called, that's the time returned by Date.now(), new Date()
 * - time goes forward from that point at the normal rate (one sec per second...) - until setCurrentTime() is called again
 */

global.Date = class extends Date {
  constructor (date) {
    super(date || Date.now())
  }

  /**
   * time-offset to shift, by 1ms resolution
   * @param time
   */
  static setCurrentTime (time) {
    Date.mockTimeOffset = time - super.now()
  }

  static now () {
    return super.now() + Date.mockTimeOffset
  }
}

Date.mockTimeOffset = 0

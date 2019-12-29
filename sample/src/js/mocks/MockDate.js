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
   * set a new "current" time.
   * note that from this point, the time continues forward as normal (until next call to setMockedTime.)
   * @param time - current time, to be returned by Date.now()
   */
  static setMockedTime (time) {
    Date.mockedDateOffset = time - super.now()
  }

  /**
   * real current time, ignoring setMockedTime forced offset.
   */
  static realNow() {
    return super.now()
  }

  static now () {
    return super.now() + Date.mockedDateOffset
  }
}

Date.mockedDateOffset = 0

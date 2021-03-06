/* global error describe it */

import validate from '../../src/js/utils/XfaceValidate'

import { assert } from 'chai'

class BaseApi {
  constructor () {
    validate(BaseApi, this)
  }

  baseFunction () {
    error('api')
  }

  baseFunction2 () {
    error('api')
  }

  _baseInternalFunction () {
  }
}

class TestImpl extends BaseApi {
  baseFunction () {
    // implemented base function
  }

  // not implmementing: baseFunction2

  _myInternalFunction () {}

  extraFunction () {}
}

class Impl2 extends BaseApi {
  abstract () {} // marker for "Abstract" implementation: OK not to implmement all baseclass methods.
  extraFunction () {}

  baseFunction () {
    // implemented base function
  }
}

describe('test interface', () => {
  it('validate methods', () => {
    try {
      // eslint-disable-next-line no-new
      new TestImpl()
    } catch (e) {
      assert.equal(e.message,
        'Interface error for class TestImpl: \n' +
        'Baseclass method not implemented: baseFunction2\n' +
        'Implemented method not in baseclass: extraFunction')
    }
  })

  it('abstract-marked class should ignore missing methods', () => {
    try {
      // eslint-disable-next-line no-new
      new Impl2()
    } catch (e) {
      assert.equal(e.message,
        'Interface error for class Impl2: \n' +
        'Implemented method not in baseclass: extraFunction')
    }
  })
})

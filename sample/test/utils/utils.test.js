/* global describe it */

import { buf2hex, hex2buf } from '../../src/js/utils/utils'

const { assert } = require('chai')
describe('utils', () => {
  it('#buf2hex', () => {
    assert.equal(buf2hex(Buffer.from('010203', 'hex')), '0x010203')
  })

  it('#hex2buf', () => {
    assert.deepEqual(hex2buf('0x010203'), Buffer.from('010203', 'hex'))
    assert.deepEqual(hex2buf('010203'), Buffer.from('010203', 'hex'))
  })
})

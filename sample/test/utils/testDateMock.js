/* global describe it before after */

import { sleep } from '../backend/testutils'
import { expect } from 'chai'

describe('#MockDate', () => {
  before(() => {
    require('../../src/js/mocks/MockDate')
  })

  after(() => {
    // make sure the time behaves as normal outside this test.
    Date.setMockedTime(Date.realNow())
  })

  let a

  it('should not change date behaviour', function () {
    a = Date.now()
    const b = new Date().getTime()
    expect(a).to.be.equal(b)
  })
  it('should allow setting future time', function () {
    Date.setMockedTime(10000)
    expect(Date.now()).to.be.closeTo(10000, 10)
  })
  it('should continue running time from last set value', async function () {
    const sleepTime = 200
    await sleep(200)
    expect(Date.now()).to.be.closeTo(10000 + sleepTime, 10)
    expect(new Date().getTime()).to.be.closeTo(10000 + sleepTime, 10)
  })
})

/* global describe beforeEach it */

// const { assert, expect } = require('chai')
const { SimpleManagerMock } = require('./mocks/SimpleManager.mock')

describe('test mgr mock', () => {
  let mgr
  beforeEach('test account', () => {
    mgr = new SimpleManagerMock()
  })

  it('test getemail', () => {
    mgr.getEmail()
  })
})

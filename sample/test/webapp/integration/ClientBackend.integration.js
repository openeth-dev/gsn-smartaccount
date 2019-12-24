/* eslint-disable no-unused-expressions */
/* global describe before it */

import { testValidationBehavior } from '../behavior/SimpleWallet.behavior'
import { testCancelByUrlBehavior } from '../behavior/SimpleManager.behavior'

describe.skip('Client <-> Backend <-> Blockchain', async function () {
  before('set up the ', async function () {
    // set up test context here
  })

  describe('SimpleWallet', async function () {
    let testContext
    before('', async function () {
      // set up test context here
    })

    testValidationBehavior(() => testContext)
  })

  describe('SimpleManager', async function () {
    let testContext
    before('', async function () {
      // set up test context here
    })

    testCancelByUrlBehavior(() => testContext)
  })
})

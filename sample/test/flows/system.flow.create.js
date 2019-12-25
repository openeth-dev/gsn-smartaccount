/* global describe it before after */

import { assert, expect } from 'chai'
import SMSmock from '../../src/js/mocks/SMS.mock'
import TestEnvironment from '../utils/TestEnvironment'

describe('System flow: Create Account', () => {
  let testEnvironment

  before('check "gsn-dock-relay" is active', async function () {
    try {
      testEnvironment = await TestEnvironment.initializeAndStartBackendForRealGSN({})
    } catch (e) {
      console.warn('skipped flow test - no active "gsn-dock-relay"')
      this.skip()
    }
  })

  after('stop backend', async () => {
    if (testEnvironment) {
      await testEnvironment.stopBackendServer()
    }
  })

  describe('create flow with account', async () => {
    const userEmail = 'shahaf@tabookey.com'
    let mgr
    let jwt, phoneNumber

    before(async function () {
      mgr = testEnvironment.manager
    })

    it('new browser attempt login', async () => {
      assert.equal(await mgr.hasWallet(), false)
      assert.equal(await mgr.getOwner(), null)
      assert.equal(await mgr.getEmail(), null)
      assert.equal(await mgr.getWalletAddress(), null)

      // jwt is "opaque". we also get the plain values back.
      const { jwt: _jwt, email, address } = await mgr.googleLogin()
      jwt = _jwt

      expect(jwt).to.match(/\w+/) // just verify there's something..
      assert.equal(email, userEmail) // only in mock...
      assert.equal(email, await mgr.getEmail())
      assert.equal(address, await mgr.getOwner())
    })

    it('after user inputs phone', async () => {
      phoneNumber = '+972541234567' // user input

      await mgr.validatePhone({ jwt, phoneNumber })
    })

    it('after user receives SMS', async () => {
      const msg = await SMSmock.asyncReadSms()

      const smsVerificationCode = msg.message.match(/(\d{3,})/)[1]

      wallet = await mgr.createWallet({ jwt, phoneNumber, smsVerificationCode })

      assert.equal(await mgr.getWalletAddress(), wallet.contract.address)
    })

    let wallet

    it('initialConfiguration', async () => {
      await mgr.setInitialConfiguration()

      console.log('wallet=', await wallet.getWalletInfo())
    })

    it('after wallet creation', async function () {
      const wallet = await mgr.loadWallet()

      const info = await wallet.getWalletInfo()
      assert.deepEqual(info.operators, [await mgr.getOwner()])
      assert.equal(info.unknownGuardians, 0)
    })
  })
})

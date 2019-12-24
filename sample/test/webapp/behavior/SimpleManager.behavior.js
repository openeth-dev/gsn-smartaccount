/* eslint-disable no-unused-expressions */
/* global describe it */
// import { expect } from 'chai'
// import assert from 'assert'

import assert from 'assert'

export function testCreateWalletBehavior (getContext) {
  const jwt = require('../../backend/testJwt').jwt
  const phoneNumber = '+1-541-754-3010'

  describe('#createWallet()', async function () {
    it('should deploy a new SmartAccount using SponsorProvider', async function () {
      const context = getContext()
      const sm = context.manager
      const minuteTimestamp = context.backendTestInstance._getMinuteTimestamp({})
      const smsVerificationCode = context.backendTestInstance._calcSmsCode({
        phoneNumber: context.backendTestInstance._formatPhoneNumber(phoneNumber),
        email: 'shahaf@tabookey.com',
        minuteTimeStamp: minuteTimestamp
      })
      const wallet = await sm.createWallet({ jwt, phoneNumber, smsVerificationCode })
      const operator = (await sm.getOwner()).toLowerCase()
      const creator = (await wallet.contract.creator()).toLowerCase()
      assert.strictEqual(creator, operator)
    })
  })
}

export function testCancelByUrlBehavior (getContext) {
  describe('#cancelByUrl()', async function () {
    it.skip('should pass parameters to backend client', async function () {
      validateMethodCalledWithRightParameters({})
    })
  })
}

function validateMethodCalledWithRightParameters () {

}

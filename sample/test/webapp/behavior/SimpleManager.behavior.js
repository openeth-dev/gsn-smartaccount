/* eslint-disable no-unused-expressions */
/* global describe it */
// import { expect } from 'chai'
// import assert from 'assert'

import assert from 'assert'
import { expect } from 'chai'

export function testCreateWalletBehavior (getContext) {
  it('should deploy a new SmartAccount using SponsorProvider', async function () {
    const context = getContext()
    const sm = context.manager
    const wallet = await sm.createWallet({
      jwt: context.jwt,
      phoneNumber: context.phoneNumber,
      smsVerificationCode: context.smsCode
    })
    const operator = (await sm.getOwner()).toLowerCase()
    const creator = (await wallet.contract.creator()).toLowerCase()
    assert.strictEqual(creator, operator)
  })
}

export function testCancelByUrlBehavior (getContext) {
  describe('#cancelByUrl()', async function () {
    it.skip('should pass parameters to backend client', async function () {
      calledWithRightArgs({})
    })
  })
}

// TODO: these tests are identical now, but I expect them to move apart later
//  if this does not happen - refactor

export function testValidatePhoneBehavior (getContext) {
  it('should pass parameters to backendx and handle http 200 OK code', async function () {
    const jwt = {}
    const phoneNumber = '0000'
    const sm = getContext().manager
    const { success, reason } = await sm.validatePhone({ jwt, phoneNumber })
    assert.strictEqual(success, true)
    assert.strictEqual(reason, null)
    calledWithRightArgs(sm.backend.validatePhone, { jwt, phoneNumber })
  })
}

export function testSignInBehavior (getContext) {
  it('should pass parameters to backendy and handle http 200 OK code', async function () {
    const jwt = {}
    const description = '0000'
    const sm = getContext().manager
    const { success, reason } = await sm.signInAsNewOperator({ jwt, description })
    assert.strictEqual(success, true)
    assert.strictEqual(reason, null)
    calledWithRightArgs(sm.backend.signInAsNewOperator, { jwt, description })
  })
}

export function calledWithRightArgs (method, args) {
  // noinspection BadExpressionStatementJS
  expect(method.calledOnce).to.be.true
  expect(method.firstCall.args[0]).to.eql(args)
}

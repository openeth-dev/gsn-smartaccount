/* eslint-disable no-unused-expressions */
/* global before it */
// import { expect } from 'chai'
// import assert from 'assert'

import assert from 'assert'
import { expect } from 'chai'
import sinon from 'sinon'

const phoneNumber = '+1-541-754-3010'

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
  let url
  let delayedOpId

  before(async function () {
    this.timeout(15000)
    const context = getContext()
    await context.createWallet({ jwt: context.jwt, phoneNumber, smsVerificationCode: context.smsCode })
    const destination = '0x' + '1'.repeat(40)
    await context.wallet.getWalletInfo()
    const res = await context.wallet.transfer({ destination, amount: 1e6, token: 'ETH' })
    delayedOpId = res.logs[0].args.delayedOpId
    const address = context.wallet.contract.address
    url = `To cancel event ${delayedOpId} on smartAccount ${address}, enter code ${context.smsCode}`
  })

  it('should pass parameters to backend client and receive transaction hash in response', async function () {
    this.timeout(15000)
    const context = getContext()
    const sm = context.manager
    sinon.spy(sm.backend)
    const jwt = context.jwt
    const result = await sm.cancelByUrl({ jwt, url })
    calledWithRightArgs(sm.backend.cancelByUrl, { jwt, url })
    assert.strictEqual(result.transactionHash.length, 66)
    const tx = await context.web3.eth.getTransactionReceipt(result.transactionHash)
    const log = (await context.wallet.contract.constructor.decodeLogs(tx.logs))[0]
    assert.strictEqual(log.event, 'BypassCallCancelled')
    assert.strictEqual(log.args.delayedOpId, delayedOpId)
  })
}

// TODO: these tests are identical now, but I expect them to move apart later
//  if this does not happen - refactor

export function testValidatePhoneBehavior (getContext) {
  it('should pass parameters to backend and handle http 200 OK code', async function () {
    const jwt = {}
    const phoneNumber = '0000'
    const sm = getContext().manager
    sinon.spy(sm.backend)
    const { success, reason } = await sm.validatePhone({ jwt, phoneNumber })
    assert.strictEqual(success, true)
    assert.strictEqual(reason, null)
    calledWithRightArgs(sm.backend.validatePhone, { jwt, phoneNumber })
  })
}

export function testSignInBehavior (getContext) {
  it('should pass parameters to backend and handle http 200 OK code', async function () {
    const jwt = {}
    const title = '0000'
    const sm = getContext().manager
    sinon.spy(sm.backend)
    const { success, reason } = await sm.signInAsNewOperator({ jwt, title })
    assert.strictEqual(success, true)
    assert.strictEqual(reason, null)
    calledWithRightArgs(sm.backend.signInAsNewOperator, { jwt, title })
  })
}

export function calledWithRightArgs (method, args) {
  assert.strictEqual(typeof method, 'function', 'This method is not defined')
  // noinspection BadExpressionStatementJS
  expect(method.calledOnce).to.be.true
  expect(method.firstCall.args[0]).to.eql(args)
}

export function testRecoverWalletBehavior (getContext) {
  let jwt
  let context
  let sm

  before(async function () {
    context = getContext()
    sm = context.manager
    jwt = context.jwt
    await context.createWallet({ jwt, phoneNumber, smsVerificationCode: context.smsCode })
  })

  it('should pass parameters to backend and handle response', async function () {
    sinon.spy(sm.backend)
    const response = await sm.recoverWallet({ jwt })
    assert.strictEqual(response.code, 200)
    calledWithRightArgs(sm.backend.recoverWallet, { jwt })
  })

  it('should make a confirm 2FA request that initiates a new pending config change', async function () {
    const response = await sm.validateRecoverWallet({ jwt, smsCode: context.smsCode })
    assert.strictEqual(response.code, 200)
    calledWithRightArgs(sm.backend.validateRecoverWallet, { jwt, smsCode: context.smsCode })
    const wallet = await sm.loadWallet()
    await wallet.getWalletInfo()
    const pending = await wallet.listPendingConfigChanges()
    assert.strictEqual(pending.length, 1)
    const first = pending[0]
    assert.strictEqual(first.operations.length, 1)
    const operation = first.operations[0]
    assert.strictEqual(operation.type, 'add_operator')
    assert.strictEqual(operation.args[0], '0x0000000000000000000000003333333333333333333333333333333333333333')
  })
}

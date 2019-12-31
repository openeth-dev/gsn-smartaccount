/* eslint-disable no-unused-expressions */
/* global describe it */
import assert from 'assert'
import { calledWithRightArgs } from './SimpleManager.behavior'

export function testValidationBehavior (getContext) {
  describe('#validateAddOperatorNow()', async function () {
    // TODO: client backend does not support this yet
    it('should pass parameters to backend and handle http 200 OK code', async function () {
      const context = getContext()
      const { error, newOperator: newOperatorResp, title: titleResp } = await context.wallet.validateAddOperatorNow({
        jwt: context.jwt,
        smsCode: context.smsCode
      })
      calledWithRightArgs(context.wallet.backend.validateAddOperatorNow, { jwt: context.jwt, smsCode: context.smsCode })
      assert.strictEqual(error, null)
      assert.strictEqual(newOperatorResp, context.newOperator)
      assert.strictEqual(titleResp, context.title)
    })
  })
}

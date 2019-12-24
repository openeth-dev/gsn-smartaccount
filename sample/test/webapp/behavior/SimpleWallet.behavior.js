/* eslint-disable no-unused-expressions */
/* global describe it */
import assert from 'assert'
import { calledWithRightArgs } from './SimpleManager.behavior'

export function testValidationBehavior (getContext) {
  describe('#validateAddOperatorNow()', async function () {
    // TODO: client backend does not support this yet
    it('should pass parameters to backend and handle http 200 OK code', async function () {
      const context = getContext()
      const { error, newOperator: newOperatorResp, description: descrResp } = await context.wallet.validateAddOperatorNow({
        jwt: context.jwt,
        url: context.url
      })
      calledWithRightArgs(context.wallet.backend.validateAddOperatorNow, { jwt: context.jwt, url: context.url })
      assert.strictEqual(error, null)
      assert.strictEqual(newOperatorResp, context.newOperator)
      assert.strictEqual(descrResp, context.description)
    })
  })
}

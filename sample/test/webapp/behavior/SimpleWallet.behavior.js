/* eslint-disable no-unused-expressions */
/* global describe it */
import { expect } from 'chai'
import assert from 'assert'

export function testValidationBehavior (getContext) {
  describe('#validateAddOperatorNow()', async function () {
    it('should pass parameters to backend and handle http 200 OK code', async function () {
      const jwt = {} // TODO
      const context = getContext()
      const { error, newOperator: newOperatorResp, description: descrResp } = await context.wallet.validateAddOperatorNow({
        jwt,
        url: context.url
      })
      expect(context.wallet.backend.validateAddOperatorNow.calledOnce).to.be.true
      expect(context.wallet.backend.validateAddOperatorNow.firstCall.args[0]).to.eql({ jwt, url: context.url })
      assert.strictEqual(error, null)
      assert.strictEqual(newOperatorResp, context.newOperator)
      assert.strictEqual(descrResp, context.description)
    })
  })
}

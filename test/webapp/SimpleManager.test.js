/* global describe before it */
import { SimpleManager } from '../mocks/SimpleManager.mock'

const assert = require('assert')

describe('SimpleManager', async function () {
  describe('constructor', async function () {
    const invalidEmail = 'hello@world.com'
    it('should refuse to accept invalid email as parameter', async function () {
      assert.strictEqual(invalidEmail, '')
    })
  })

  describe('#getEmail()', async function () {
    const email = 'hello@world.com'
    let sm
    before(async function () {
      sm = new SimpleManager()
    })

    it('should return the email', async function () {
      const retEmail = sm.getEmail()
      assert.strictEqual(retEmail, email)
    })
  })
})

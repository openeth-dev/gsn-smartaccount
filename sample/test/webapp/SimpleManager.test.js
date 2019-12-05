/* eslint-disable no-unused-expressions */
/* global describe beforeEach it */
import chai, { expect } from 'chai'
import chaiAsPromised from 'chai-as-promised'

import sinon from 'sinon'
import assert from 'assert'

import SimpleManager from '../../src/js/impl/SimpleManager'

chai.use(chaiAsPromised)
chai.should()

describe('SimpleManager', async function () {
  const email = 'hello@world.com'

  let sm

  beforeEach(async function () {
    sm = new SimpleManager({})
  })

  describe('#googleLogin()', async function () {
    it('should return promise with JWT if user approves oauth login request', async function () {
      sm.accountApi = {
        googleLogin: function () {
          return new Promise((resolve, reject) => {
            setTimeout(() => {
              resolve({ jwt: 'TODO', email: email, address: '' })
            }, 100)
          })
        }
      }
      const { jwt, email: jwtEmail, address } = await sm.googleLogin()
      assert.strictEqual(jwt, 'TODO')
      assert.strictEqual(jwtEmail, email)
      assert.strictEqual(address, '')
    })

    it('should reject promise with error if user rejects oauth login request', async function () {
      sm.accountApi = {
        googleLogin: function () {
          return new Promise((resolve, reject) => {
            setTimeout(() => {
              reject(new Error('Client rejected'))
            }, 100)
          })
        }
      }
      const promise = sm.googleLogin()
      await expect(promise).to.eventually.be.rejectedWith('Client rejected')
    })
  })

  describe('#validatePhone()', async function () {
    it('should pass parameters to backend ', async function () {
      sm.backend = {
        validatePhone: sinon.spy()
      }
      const jwt = {}
      const phone = '0000'
      await sm.validatePhone({ jwt, phone })
      expect(sm.backend.validatePhone.calledOnce).to.be.true
      expect(sm.backend.validatePhone.firstCall.args[0]).to.eql({ jwt, phone })
    })
  })

  describe('#createWallet()', async function () {
  })

  describe('#googleAuthenticate()', async function () {
  })

  describe('#getWalletAddress()', async function () {
  })

  describe('#loadWallet()', async function () {
  })

  describe('#recoverWallet()', async function () {
  })
})

/* eslint-disable no-unused-expressions */
/* global describe beforeEach before it */
import assert from 'assert'
import chai, { expect } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import sinon from 'sinon'

import SimpleManager from '../../src/js/impl/SimpleManager'
import {
  testCancelByUrlBehavior,
  testCreateWalletBehavior, testSignInBehavior,
  testValidatePhoneBehavior
} from './behavior/SimpleManager.behavior'
import TestEnvironment from '../utils/TestEnvironment'

chai.use(chaiAsPromised)
chai.should()
const mockBackendBase = {
  getAddresses: async function () {
    return {
      watchdog: '0x' + '1'.repeat(40)
    }
  }
}

async function newTest (backend) {
  const testEnvironment = await TestEnvironment.initializeWithFakeBackendAndGSN({
    clientBackend: backend
  })
  await testEnvironment.manager.accountApi.googleLogin()
  return testEnvironment
}

describe('SimpleManager', async function () {
  const email = 'shahaf@tabookey.com'

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
            }, 1)
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
            }, 1)
          })
        }
      }
      const promise = sm.googleLogin()
      await expect(promise).to.eventually.be.rejectedWith('Client rejected')
    })
  })

  describe('#validatePhone()', async function () {
    let testContext
    before(async function () {
      const mockBackend = {
        validatePhone: sinon.spy(() => { return { code: 200 } }),
        ...mockBackendBase
      }
      testContext = await newTest(mockBackend)
    })
    testValidatePhoneBehavior(() => testContext)
  })

  describe('#signInAsNewOperator()', async function () {
    let testContext
    before(async function () {
      const mockBackend = {
        signInAsNewOperator: sinon.spy(() => { return { code: 200 } }),
        ...mockBackendBase
      }
      testContext = await newTest(mockBackend)
    })
    testSignInBehavior(() => testContext)
  })

  describe('#setSignInObserver()', async function () {
    it('should observe progress of sign in process via calls to the observer')
  })

  describe('#createWallet()', async function () {
    let testContext

    before(async function () {
      const mockBackend = {
        createAccount: async function () {
          return {
            approvalData: '0x' + 'f'.repeat(64),
            smartAccountId: '0x' + '1'.repeat(64)
          }
        },
        getSmartAccountId: async function () {
          return '0x' + '1'.repeat(64)
        },
        ...mockBackendBase
      }
      testContext = await newTest(mockBackend)
      testContext.jwt = {}
      testContext.phoneNumber = '1'
      testContext.smsCode = '1234'
    })

    testCreateWalletBehavior(() => testContext)

    it('should throw if there is no operator set')

    it('should throw if this user already has a SmartAccount deployed')
  })

  describe('#googleAuthenticate()', async function () {
  })

  describe('#getWalletAddress()', async function () {
  })

  describe('#loadWallet()', async function () {
  })

  testCancelByUrlBehavior()

  describe('#recoverWallet()', async function () {
  })
})

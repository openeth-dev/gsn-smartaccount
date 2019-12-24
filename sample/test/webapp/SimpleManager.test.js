/* eslint-disable no-unused-expressions */
/* global describe beforeEach before it */
import assert from 'assert'
import chai, { expect } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import sinon from 'sinon'
import Web3 from 'web3'

import SimpleManager from '../../src/js/impl/SimpleManager'
import { Backend } from '../../src/js/backend/Backend'
import { testCancelByUrlBehavior, testCreateWalletBehavior } from './behavior/SimpleManager.behavior'
import TestEnvironment from '../utils/TestEnvironment'

chai.use(chaiAsPromised)
chai.should()

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
  getAddresses: async function () {
    return {
      watchdog: '0x' + '1'.repeat(20)
    }
  }
}

const ethNodeUrl = 'http://localhost:8545'

async function newTest (relayOptions) {
  // we use predictable SMS code generation for tests. this code predicts SMS codes.
  const backendTestInstance = new Backend(
    { audience: '202746986880-u17rbgo95h7ja4fghikietupjknd1bln.apps.googleusercontent.com' })
  backendTestInstance.secretSMSCodeSeed = Buffer.from('f'.repeat(64), 'hex')
  const testEnvironment = await TestEnvironment.initializeWithFakeBackendAndGSN({
    relayOptions,
    web3provider: new Web3.providers.HttpProvider(ethNodeUrl),
    clientBackend: mockBackend,
    shouldDeployMockHub: true,
    shouldFundRelay: false,
    shouldStartBackend: false,
    shouldAddBackend: false
  })
  testEnvironment.backendTestInstance = backendTestInstance
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

  describe.skip('#validatePhone()', async function () {
    it('should pass parameters to backend and handle http 200 OK code', async function () {
      sm.backend = {
        validatePhone: sinon.spy(() => { return { code: 200 } })
      }
      const jwt = {}
      const phoneNumber = '0000'
      const { success, reason } = await sm.validatePhone({ jwt, phoneNumber })
      assert.strictEqual(success, true)
      assert.strictEqual(reason, null)
      expect(sm.backend.validatePhone.calledOnce).to.be.true
      expect(sm.backend.validatePhone.firstCall.args[0]).to.eql({ jwt, phoneNumber })
    })
  })

  describe.skip('#signInAsNewOperator()', async function () {
    it('should pass parameters to backend and handle http 200 OK code', async function () {
      sm.backend = {
        signInAsNewOperator: sinon.spy(() => { return { code: 200 } })
      }
      const jwt = {}
      const description = '0000'
      const { success, reason } = await sm.signInAsNewOperator({ jwt, description })
      assert.strictEqual(success, true)
      assert.strictEqual(reason, null)
      expect(sm.backend.signInAsNewOperator.calledOnce).to.be.true
      expect(sm.backend.signInAsNewOperator.firstCall.args[0]).to.eql({ jwt, description })
    })
  })

  describe('#setSignInObserver()', async function () {
    it('should observe progress of sign in process via calls to the observer')
  })

  describe('#createWallet()', async function () {

    // TODO: extract test to behavior file
    describe('main flows', async function () {
      let testContext

      before(async function () {
        testContext = await newTest()
      })

      testCreateWalletBehavior(() => testContext)

      describe('secondary flows', async function () {
        it('should throw if there is no operator set')

        it('should throw if this user already has a SmartAccount deployed')
      })
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
})
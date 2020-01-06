/* eslint-disable no-unused-expressions */
/* global describe beforeEach before it */
import assert from 'assert'
import chai, { expect } from 'chai'
import chaiAsPromised from 'chai-as-promised'

import SimpleManager from '../../src/js/impl/SimpleManager'
import {
  testCancelByUrlBehavior,
  testCreateWalletBehavior, testRecoverWalletBehavior, testSignInBehavior,
  testValidatePhoneBehavior
} from './behavior/SimpleManager.behavior'
import TestEnvironment from '../utils/TestEnvironment'
import { Watchdog } from '../../src/js/backend/Guardian'
import BaseBackendMock from '../mocks/BaseBackend.mock'

import { forgeApprovalData } from 'safechannels-contracts/test/utils'

chai.use(chaiAsPromised)
chai.should()
const smartAccountId = '0x' + '1'.repeat(64)

async function newTest (backend) {
  const testEnvironment = await TestEnvironment.initializeWithFakeBackendAndGSN({
    clientBackend: backend
  })
  await testEnvironment.manager.accountApi.googleLogin()
  return testEnvironment
}

async function setCreateAccount (backend, smartAccountId, testContext) {
  backend.createAccount = async function createAccount () {
    return {
      approvalData: await forgeApprovalData(smartAccountId, testContext.factory, testContext.from),
      smartAccountId
    }
  }
}

describe('SimpleManager', async function () {
  const email = 'shahaf@tabookey.com'

  let sm

  beforeEach(async function () {
    // TODO: put in proper values (these only satisfy the "nonNull" check)
    sm = new SimpleManager({ accountApi: false, factoryConfig: false, backend: false })
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
        validatePhone: () => { return { code: 200 } },
        ...BaseBackendMock
      }
      testContext = await newTest(mockBackend)
    })
    testValidatePhoneBehavior(() => testContext)
  })

  describe('#signInAsNewOperator()', async function () {
    let testContext
    before(async function () {
      const mockBackend = {
        signInAsNewOperator: () => { return { code: 200 } },
        ...BaseBackendMock
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
      testContext = await newTest(BaseBackendMock)
      await setCreateAccount(BaseBackendMock, smartAccountId, testContext)
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

  describe('#cancelByUrl()', async function () {
    let testContext

    before(async function () {
      const mockBackend = {
        // eslint-disable-next-line no-unused-vars
        cancelByUrl: async function ({ jwt, url }) {
          const { delayedOpId } = Watchdog._extractCancelParamsFromUrl({ url })
          const res = await testContext.wallet.cancelPending(delayedOpId)
          return { transactionHash: res.tx }
        },
        ...BaseBackendMock
      }

      testContext = await newTest(mockBackend)
      await setCreateAccount(mockBackend, smartAccountId, testContext)
      testContext.jwt = {}
      testContext.smsCode = '1234'
    })

    testCancelByUrlBehavior(() => testContext)
  })

  describe('#recoverWallet()', async function () {
    const newOperator = '0x' + '3'.repeat(40)
    let testContext

    before(async function () {
      const mockBackend = {
        recoverWallet: function () {
          return { code: 200 }
        },
        validateRecoverWallet: async function () {
          await testContext.wallet.getWalletInfo() // Needed for stateId
          await testContext.wallet.scheduleAddOperator({ newOperator })
          return {
            transactionHash: '0xdeadface'
          }
        },
        ...BaseBackendMock
      }
      testContext = await TestEnvironment.initializeWithFakeBackendAndGSN({
        clientBackend: mockBackend
      })
      await setCreateAccount(mockBackend, smartAccountId, testContext)
      await testContext.manager.googleLogin()
      testContext.smsCode = '1234'
      testContext.jwt = {}
      testContext.newOperatorAddress = newOperator
    })

    testRecoverWalletBehavior(() => testContext)
  })
})

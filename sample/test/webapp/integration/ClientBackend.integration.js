/* eslint-disable no-unused-expressions */
/* global describe before after */

import { testValidationBehavior } from '../behavior/SimpleWallet.behavior'
import { testCancelByUrlBehavior, testCreateWalletBehavior } from '../behavior/SimpleManager.behavior'
import TestEnvironment from '../../utils/TestEnvironment'
import { Backend } from '../../../src/js/backend/Backend'
import SMSmock from '../../../src/js/mocks/SMS.mock'
import { SmsManager } from '../../../src/js/backend/SmsManager'

const jwt = require('../../backend/testJwt').jwt
const phoneNumber = '+1-541-754-3010'

// we use predictable SMS code generation for tests. this code predicts SMS codes.
function calculateSmsCode () {
  const smsProvider = new SMSmock()
  const smsManager = new SmsManager({ smsProvider, secretSMSCodeSeed: Buffer.from('f'.repeat(64), 'hex') })
  const backendTestInstance = new Backend(
    {
      smsManager: smsManager,
      audience: '202746986880-u17rbgo95h7ja4fghikietupjknd1bln.apps.googleusercontent.com'
    })
  backendTestInstance.secretSMSCodeSeed = Buffer.from('f'.repeat(64), 'hex')
  const minuteTimestamp = backendTestInstance.smsManager.getMinuteTimestamp({})
  const phoneNumber = '+1-541-754-3010'
  return backendTestInstance.smsManager.calcSmsCode({
    phoneNumber: backendTestInstance._formatPhoneNumber(phoneNumber),
    email: 'shahaf@tabookey.com',
    minuteTimeStamp: minuteTimestamp
  })
}

async function newTest () {
  const testContext = await TestEnvironment.initializeAndStartBackendForRealGSN({})
  await testContext.manager.googleLogin()
  testContext.jwt = jwt
  testContext.smsCode = calculateSmsCode()
  return testContext
}

describe('Client <-> Backend <-> Blockchain', async function () {
  describe('SimpleManager', async function () {
    after('stop backend', async () => {
      await TestEnvironment.stopBackendServer()
    })

    describe('#cancelByUrl()', async function () {
      let testContext
      before(async function () {
        testContext = await newTest()
      })
      testCancelByUrlBehavior(() => testContext)
    })

    describe('#createWallet()', async function () {
      let testContext
      before(async function () {
        testContext = await newTest()
        testContext.phoneNumber = '+1-541-754-3010'
      })

      testCreateWalletBehavior(() => testContext)
    })
  })

  describe.skip('SimpleWallet', async function () {
    let testContext
    before(async function () {
      testContext = await TestEnvironment.initializeAndStartBackendForRealGSN({})
      await testContext.manager.googleLogin()

      const wallet = await testContext.manager.createWallet({
        jwt, phoneNumber, smsVerificationCode: calculateSmsCode()
      })
      testContext.wallet = wallet
      testContext.smartAccount = wallet.contract
    })

    after('stop backend', async () => {
      await TestEnvironment.stopBackendServer()
    })

    testValidationBehavior(() => testContext)
  })
})

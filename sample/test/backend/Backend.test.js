/* global describe before afterEach it */

import { Account, Backend } from '../../src/js/backend/Backend'
import { assert } from 'chai'
import SMSmock from '../../src/js/mocks/SMS.mock'
import { LoginTicket } from 'google-auth-library/build/src/auth/loginticket'

const ethUtils = require('ethereumjs-util')
const abi = require('ethereumjs-abi')
const phone = require('phone')

function hookBackend (backend) {
  backend.orig_verifyJWT = backend._verifyJWT
  backend._verifyJWT = async function (jwt) {
    const parsed = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64'))

    return {
      getPayload: () => parsed
    }
  }
  backend.secretSMSCodeSeed = Buffer.from('f'.repeat(64), 'hex')
}

function unhookBackend (backend) {
  backend._verifyJWT = backend.orig_verifyJWT
  delete backend.orig_verifyJWT
}

describe('Backend', async function () {
  let backend
  const keypair = {
    privateKey: Buffer.from('20e12d5dc484a03c969d48446d897a006ebef40a806dab16d58db79ba64aa01f', 'hex'),
    address: '0x68cc521201a7f8617c5ce373b0f0993ee665ef63'
  }
  // let webapp
  let smsProvider
  const jwt = require('./testJwt').jwt
  let smsCode
  const phoneNumber = '+972541234567'
  const email = 'shahaf@tabookey.com'
  let verifyFn

  before(async function () {
    // webapp = new SimpleManagerMock()
    smsProvider = new SMSmock()

    backend = new Backend(
      {
        smsProvider,
        audience: '202746986880-u17rbgo95h7ja4fghikietupjknd1bln.apps.googleusercontent.com',
        ecdsaKeyPair: keypair
      })

    // hooking google-api so we don't actually send jwt tot their server
    hookBackend(backend, verifyFn)
  })
  describe('sms code generation', async function () {
    let ts
    let firstCode
    let formattedNumber
    before(async function () {
      formattedNumber = backend._formatPhoneNumber(phoneNumber)
      ts = backend._getMinuteTimestamp({})
      firstCode = backend._calcSmsCode(
        { phoneNumber: formattedNumber, email: email, minuteTimeStamp: ts })
    })
    afterEach(async function () {
      Date.now = Date.nowOrig
      delete Date.nowOrig
    })
    it('should generate the same sms code for calls within 10 minute window', function () {
      Date.nowOrig = Date.now
      Date.now = function () {
        return Date.nowOrig() + 5e5 // ~9 minutes in the future
      }
      // calculate desired timestamp from a given sms code
      ts = backend._getMinuteTimestamp({ expectedSmsCode: firstCode })
      const secondCode = backend._calcSmsCode(
        { phoneNumber: formattedNumber, email: email, minuteTimeStamp: ts })
      assert.equal(firstCode, secondCode)
    })

    it('should generate different sms code for calls out of the 10 minute window', function () {
      Date.nowOrig = Date.now
      Date.now = function () {
        return Date.nowOrig() + 6e5 // = 10 minutes in the future
      }
      // calculate desired timestamp from a given sms code
      ts = backend._getMinuteTimestamp({ expectedSmsCode: firstCode })
      const secondCode = backend._calcSmsCode(
        { phoneNumber: formattedNumber, email: email, minuteTimeStamp: ts })
      assert.isTrue(parseInt(secondCode).toString() === secondCode.toString())
      assert.notEqual(firstCode, secondCode)
    })
  })

  describe('validatePhone', async function () {
    it('should throw on invalid phone number', async function () {
      const phoneNumber = '1243 '
      const invalidjwt = 'token'
      try {
        await backend.validatePhone({ jwt: invalidjwt, phoneNumber })
        assert.fail()
      } catch (e) {
        assert.equal(e.toString(), `Error: Invalid phone number: ${phoneNumber}`)
      }
    })

    it('should throw on invalid jwt token', async function () {
      const invalidjwt = 'invalid token'
      try {
        await backend.validatePhone({ jwt: invalidjwt, phoneNumber })
        assert.fail()
      } catch (e) {
        assert.equal(e.toString(), `Error: invalid jwt: ${invalidjwt}`)
      }
    })

    it('should validate phone number', async function () {
      console.log('\nvalidate phone')
      // let jwt = 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjViNWRkOWJlNDBiNWUxY2YxMjFlMzU3M2M4ZTQ5ZjEyNTI3MTgzZDMiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJhY2NvdW50cy5nb29nbGUuY29tIiwiYXpwIjoiMjAyNzQ2OTg2ODgwLXUxN3JiZ285NWg3amE0ZmdoaWtpZXR1cGprbmQxYmxuLmFwcHMuZ29vZ2xldXNlcmNvbnRlbnQuY29tIiwiYXVkIjoiMjAyNzQ2OTg2ODgwLXUxN3JiZ285NWg3amE0ZmdoaWtpZXR1cGprbmQxYmxuLmFwcHMuZ29vZ2xldXNlcmNvbnRlbnQuY29tIiwic3ViIjoiMTE1NDEzOTQ3Njg0Mjk5Njg1NDQ5IiwiaGQiOiJ0YWJvb2tleS5jb20iLCJlbWFpbCI6InNoYWhhZkB0YWJvb2tleS5jb20iLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwibm9uY2UiOiJoZWxsby13b3JsZCIsImlhdCI6MTU3NTM5Njg2NiwiZXhwIjoxNTc1NDAwNDY2LCJqdGkiOiJiMDk2YzYwY2EzZjlmNGRjN2Y5MzEwM2U4ZGRkOGU1YzAyOWVlOTgwIn0.nXcDojzPnXp300gXYhGQ_uPEU2MGRszNHTbka__FZbnHg0PdmZpEd-4JAOh_rRq0UsmOzelLPd49XlBiCS62US0JqZUxqVJd1UvvvetwMJ9X3Nds_CkkTVF3Dx0hjzLrbDlvf3YOOuUPkoI1OTbtsN2iJtJLBNEQIz_l7rrZVv287-6JvgperPkLu9Dbqpneas7kzB7EDWj8lAI2a4Ru06YkZKb017RDtQNRaLHcMb9hHqqFYXaIaafFOXhS0ESHQa4GhDNMxEYTxW47-MXYjPKnxK_g4APWua2aFAwjfpmZmmXyCnv8wNvPyHrYJxIqvL2z2-IYj36cQtpFgp8Asg'
      await backend.validatePhone({ jwt, phoneNumber })
      smsCode = backend._getSmsCode(
        { phoneNumber: backend._formatPhoneNumber(phoneNumber), email: email })
      assert.notEqual(smsCode, undefined)
    })
  })

  describe('createAccount', async function () {
    it('should throw on invalid sms code', async function () {
      const wrongSmsCode = smsCode - 1
      try {
        await backend.createAccount({ jwt, smsCode: wrongSmsCode, phoneNumber })
        assert.fail()
      } catch (e) {
        assert.equal(e.toString(), `Error: invalid sms code: ${wrongSmsCode}`)
      }
    })

    it('should createAccount by verifying sms code', async function () {
      console.log('smsCode', smsCode)
      const accountCreatedResponse = await backend.createAccount({ jwt, smsCode, phoneNumber })
      const expectedSmartAccountId = abi.soliditySHA3(['string'], [email])
      assert.equal(accountCreatedResponse.smartAccountId, '0x' + expectedSmartAccountId.toString('hex'))

      const approvalData = accountCreatedResponse.approvalData
      assert.isTrue(ethUtils.isHexString(approvalData))
      const decoded = abi.rawDecode(['bytes4', 'bytes'], Buffer.from(accountCreatedResponse.approvalData.slice(2), 'hex'))
      const timestamp = decoded[0]
      let sig = decoded[1]
      sig = ethUtils.fromRpcSig(sig)
      let hash = abi.soliditySHA3(['bytes32', 'bytes4'],
        [Buffer.from(accountCreatedResponse.smartAccountId.slice(2), 'hex'), timestamp])
      hash = abi.soliditySHA3(['string', 'bytes32'], ['\x19Ethereum Signed Message:\n32', hash])
      const backendExpectedAddress = ethUtils.publicToAddress(ethUtils.ecrecover(hash, sig.v, sig.r, sig.s))
      assert.equal('0x' + backendExpectedAddress.toString('hex'), backend.ecdsaKeyPair.address)
      const account = new Account(
        {
          email: email,
          phone: phone(phoneNumber),
          verificationCode: smsCode.toString(),
          verified: true
        })
      const actualAccount = backend.accounts[email]
      assert.deepEqual(actualAccount, account)
    })
  })

  describe('addDeviceNow', async function () {

  })
})

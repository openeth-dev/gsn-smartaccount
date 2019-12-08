/* global describe before it */

import { Account, Backend } from '../../src/js/backend/Backend'
import { assert /* , expect */ } from 'chai'
import SMSmock from '../../src/js/mocks/SMS.mock'
import { LoginTicket } from 'google-auth-library/build/src/auth/loginticket'

const ethUtils = require('ethereumjs-util')
const phone = require('phone')
const fs = require('fs')
// const ethWallet = require('ethereumjs-wallet')
//
// function newEphemeralKeypair () {
//   let a = ethWallet.generate()
//   return {
//     privateKey: a.privKey,
//     address: '0x' + a.getAddress().toString('hex')
//   }
// }

function hookBackend (backend, verifyFn) {
  backend.gclient._orig_verifyIdToken = backend.gclient.verifyIdToken
  verifyFn = async function ({ idToken, audience }) {
    try {
      return await backend.gclient._orig_verifyIdToken({ idToken, audience })
    } catch (e) {
      console.log('hooking google auth verifyIdToken() function')
      if (e.toString().includes('Error: Token used too late')) {
        const rawTicket = JSON.parse(fs.readFileSync('./test/backend/ticket.json', 'utf8'))
        const loginTicket = new LoginTicket(rawTicket.envelope, rawTicket.payload)
        return loginTicket
      }
    }
  }
  backend.gclient.verifyIdToken = verifyFn
}

function unhookBackend (backend) {
  backend.gclient.verifyIdToken = backend.gclient._orig_verifyIdToken
  delete backend.gclient._orig_verifyIdToken
}

describe('Backend', async function () {
  let backend
  const keypair = {
    privateKey: Buffer.from('20e12d5dc484a03c969d48446d897a006ebef40a806dab16d58db79ba64aa01f', 'hex'),
    address: '0x68cc521201a7f8617c5ce373b0f0993ee665ef63'
  }
  // let webapp
  let smsProvider
  const jwt = 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjViNWRkOWJlNDBiNWUxY2YxMjFlMzU3M2M4ZTQ5ZjEyNTI3MTgzZDMiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJhY2NvdW50cy5nb29nbGUuY29tIiwiYXpwIjoiMjAyNzQ2OTg2ODgwLXUxN3JiZ285NWg3amE0ZmdoaWtpZXR1cGprbmQxYmxuLmFwcHMuZ29vZ2xldXNlcmNvbnRlbnQuY29tIiwiYXVkIjoiMjAyNzQ2OTg2ODgwLXUxN3JiZ285NWg3amE0ZmdoaWtpZXR1cGprbmQxYmxuLmFwcHMuZ29vZ2xldXNlcmNvbnRlbnQuY29tIiwic3ViIjoiMTE1NDEzOTQ3Njg0Mjk5Njg1NDQ5IiwiaGQiOiJ0YWJvb2tleS5jb20iLCJlbWFpbCI6InNoYWhhZkB0YWJvb2tleS5jb20iLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwibm9uY2UiOiJoZWxsby13b3JsZCIsImlhdCI6MTU3NTU1OTk4MCwiZXhwIjoxNTc1NTYzNTgwLCJqdGkiOiJjNTU4MjllODUxMTZmZTZhZTI3NmZjZWQzYmJkMjUzZmQwZGFiNjRjIn0.gFVHCwndqf8BYgX2p6BJB1B6TeJQqI14khisxHr_43OVHyny52sctUp38iqeJJJ0gz4I-K4KCfxAR4e5Bm0ZFIDhbEEBKq8XAF4NI6W3pOyhxH8AQljaXtZ4hWBsuZApVsLsq9e7OY2NC5MbawtehbWSKAYd_zJjf76tkmFRlgI_BQb2Sox257lp0U7ib_gHLmHxSHcCvwsro2CPyl4ZFzO4EqNufU7n6VNh7Ey6V0EYTsTeIdqwzH6mFuGLwH8S8PQV8JJD4ZyWuUZBcNNRYAz_SjElSzZ9HCwtuYGvlIx9ognE1ga1w-O7EdRwfg58J6Cn35baBHr6z9O02luCJg'
  let smsCode
  const phoneNumber = '+972541234567'
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

    it('should throw on expired jwt', async function () {
      const invalidjwt = 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjViNWRkOWJlNDBiNWUxY2YxMjFlMzU3M2M4ZTQ5ZjEyNTI3MTgzZDMiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJhY2NvdW50cy5nb29nbGUuY29tIiwiYXpwIjoiMjAyNzQ2OTg2ODgwLXUxN3JiZ285NWg3amE0ZmdoaWtpZXR1cGprbmQxYmxuLmFwcHMuZ29vZ2xldXNlcmNvbnRlbnQuY29tIiwiYXVkIjoiMjAyNzQ2OTg2ODgwLXUxN3JiZ285NWg3amE0ZmdoaWtpZXR1cGprbmQxYmxuLmFwcHMuZ29vZ2xldXNlcmNvbnRlbnQuY29tIiwic3ViIjoiMTE1NDEzOTQ3Njg0Mjk5Njg1NDQ5IiwiaGQiOiJ0YWJvb2tleS5jb20iLCJlbWFpbCI6InNoYWhhZkB0YWJvb2tleS5jb20iLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwibm9uY2UiOiJoZWxsby13b3JsZCIsImlhdCI6MTU3NTM5Njg2NiwiZXhwIjoxNTc1NDAwNDY2LCJqdGkiOiJiMDk2YzYwY2EzZjlmNGRjN2Y5MzEwM2U4ZGRkOGU1YzAyOWVlOTgwIn0.nXcDojzPnXp300gXYhGQ_uPEU2MGRszNHTbka__FZbnHg0PdmZpEd-4JAOh_rRq0UsmOzelLPd49XlBiCS62US0JqZUxqVJd1UvvvetwMJ9X3Nds_CkkTVF3Dx0hjzLrbDlvf3YOOuUPkoI1OTbtsN2iJtJLBNEQIz_l7rrZVv287-6JvgperPkLu9Dbqpneas7kzB7EDWj8lAI2a4Ru06YkZKb017RDtQNRaLHcMb9hHqqFYXaIaafFOXhS0ESHQa4GhDNMxEYTxW47-MXYjPKnxK_g4APWua2aFAwjfpmZmmXyCnv8wNvPyHrYJxIqvL2z2-IYj36cQtpFgp8Asg'

      try {
        unhookBackend(backend)
        await backend.validatePhone({ jwt: invalidjwt, phoneNumber })
        assert.fail()
      } catch (e) {
        assert.isTrue(e.toString().includes('Error: Token used too late'))
      } finally {
        hookBackend(backend, verifyFn)
      }
    })

    it('should validate phone number', async function () {
      console.log('\nvalidate phone')
      // let jwt = 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjViNWRkOWJlNDBiNWUxY2YxMjFlMzU3M2M4ZTQ5ZjEyNTI3MTgzZDMiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJhY2NvdW50cy5nb29nbGUuY29tIiwiYXpwIjoiMjAyNzQ2OTg2ODgwLXUxN3JiZ285NWg3amE0ZmdoaWtpZXR1cGprbmQxYmxuLmFwcHMuZ29vZ2xldXNlcmNvbnRlbnQuY29tIiwiYXVkIjoiMjAyNzQ2OTg2ODgwLXUxN3JiZ285NWg3amE0ZmdoaWtpZXR1cGprbmQxYmxuLmFwcHMuZ29vZ2xldXNlcmNvbnRlbnQuY29tIiwic3ViIjoiMTE1NDEzOTQ3Njg0Mjk5Njg1NDQ5IiwiaGQiOiJ0YWJvb2tleS5jb20iLCJlbWFpbCI6InNoYWhhZkB0YWJvb2tleS5jb20iLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwibm9uY2UiOiJoZWxsby13b3JsZCIsImlhdCI6MTU3NTM5Njg2NiwiZXhwIjoxNTc1NDAwNDY2LCJqdGkiOiJiMDk2YzYwY2EzZjlmNGRjN2Y5MzEwM2U4ZGRkOGU1YzAyOWVlOTgwIn0.nXcDojzPnXp300gXYhGQ_uPEU2MGRszNHTbka__FZbnHg0PdmZpEd-4JAOh_rRq0UsmOzelLPd49XlBiCS62US0JqZUxqVJd1UvvvetwMJ9X3Nds_CkkTVF3Dx0hjzLrbDlvf3YOOuUPkoI1OTbtsN2iJtJLBNEQIz_l7rrZVv287-6JvgperPkLu9Dbqpneas7kzB7EDWj8lAI2a4Ru06YkZKb017RDtQNRaLHcMb9hHqqFYXaIaafFOXhS0ESHQa4GhDNMxEYTxW47-MXYjPKnxK_g4APWua2aFAwjfpmZmmXyCnv8wNvPyHrYJxIqvL2z2-IYj36cQtpFgp8Asg'
      try {
        smsCode = await backend.validatePhone({ jwt, phoneNumber })
        assert.notEqual(smsCode, undefined)
      } catch (e) {
        console.log(e)
        assert.fail()
      }
    })
  })

  describe('createAccount', async function () {
    it('should throw on invalid sms code', async function () {
      const wrongSmsCode = smsCode - 1
      console.log('smsCode', wrongSmsCode)
      try {
        await backend.createAccount({ jwt, smsCode: wrongSmsCode, phoneNumber })
        assert.fail()
      } catch (e) {
        assert.equal(e.toString(), `Error: invalid sms code: ${wrongSmsCode}`)
      }
    })

    it('should createAccount by verifying sms code', async function () {
      console.log('smsCode', smsCode)
      const approvalData = (await backend.createAccount({ jwt, smsCode, phoneNumber })).toString('hex')
      // console.log('approval data', approvalData)
      assert.isTrue(ethUtils.isHexString('0x' + approvalData))
      const account = new Account(
        {
          email: 'shahaf@tabookey.com',
          phone: phone(phoneNumber),
          verificationCode: smsCode.toString(),
          verified: true
        })
      const actualAccount = backend.accounts['shahaf@tabookey.com']
      assert.deepEqual(actualAccount, account)
    })
  })

  describe('addDeviceNow', async function () {

  })
})

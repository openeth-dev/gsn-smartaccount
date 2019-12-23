/* global before describe after it */

import { assert /* , expect */ } from 'chai'
import ClientBackend from '../../src/js/backend/ClientBackend'
import Webserver from '../../src/js/backend/Webserver'
import abi from 'ethereumjs-abi'

describe('http layer tests', async function () {
  let client
  let server
  let mockBE
  let mockWD
  const port = 1234
  const myJWT = 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjViNWRkOWJlNDBiNWUxY2YxMjFlMzU3M2M4ZTQ5ZjEyNTI3MTgzZDMiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJhY2NvdW50cy5nb29nbGUuY29tIiwiYXpwIjoiMjAyNzQ2OTg2ODgwLXUxN3JiZ285NWg3amE0ZmdoaWtpZXR1cGprbmQxYmxuLmFwcHMuZ29vZ2xldXNlcmNvbnRlbnQuY29tIiwiYXVkIjoiMjAyNzQ2OTg2ODgwLXUxN3JiZ285NWg3amE0ZmdoaWtpZXR1cGprbmQxYmxuLmFwcHMuZ29vZ2xldXNlcmNvbnRlbnQuY29tIiwic3ViIjoiMTE1NDEzOTQ3Njg0Mjk5Njg1NDQ5IiwiaGQiOiJ0YWJvb2tleS5jb20iLCJlbWFpbCI6InNoYWhhZkB0YWJvb2tleS5jb20iLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwibm9uY2UiOiJoZWxsby13b3JsZCIsImlhdCI6MTU3NTU1OTk4MCwiZXhwIjoxNTc1NTYzNTgwLCJqdGkiOiJjNTU4MjllODUxMTZmZTZhZTI3NmZjZWQzYmJkMjUzZmQwZGFiNjRjIn0.gFVHCwndqf8BYgX2p6BJB1B6TeJQqI14khisxHr_43OVHyny52sctUp38iqeJJJ0gz4I-K4KCfxAR4e5Bm0ZFIDhbEEBKq8XAF4NI6W3pOyhxH8AQljaXtZ4hWBsuZApVsLsq9e7OY2NC5MbawtehbWSKAYd_zJjf76tkmFRlgI_BQb2Sox257lp0U7ib_gHLmHxSHcCvwsro2CPyl4ZFzO4EqNufU7n6VNh7Ey6V0EYTsTeIdqwzH6mFuGLwH8S8PQV8JJD4ZyWuUZBcNNRYAz_SjElSzZ9HCwtuYGvlIx9ognE1ga1w-O7EdRwfg58J6Cn35baBHr6z9O02luCJg'
  const myPhoneNumber = '+972541234567'
  const mySmsCode = 1234561
  const myDelayedOpId = 'delayedOpId'
  const myAddress = '0xdeadbeef'
  const serverURL = `http://localhost:${port}`

  before(async function () {
    mockBE = {}
    mockBE.validatePhone = function validatePhone () {}
    mockBE.createAccount = function createAccount () {}
    mockBE.addOperatorNow = function addOperatorNow () {}
    mockBE.handleNotifications = function handleNotifications () {}
    mockWD = {}
    mockWD.cancelChange = function cancelChange () {}
  })
  it('should construct webclient, webserver and start server', async function () {
    try {
      server = new Webserver({ port, backend: mockBE, watchdog: mockWD })
      client = new ClientBackend({ serverURL })
      server.start()
    } catch (e) {
      console.log(e)
      assert.fail()
    }
  })

  describe('validatePhone', async function () {
    it('should send valid http request and receive valid response', async function () {
      mockBE.validatePhone = function validatePhone ({ jwt, phoneNumber }) {
        assert.equal(jwt, myJWT)
        assert.equal(phoneNumber, myPhoneNumber)
      }
      await client.validatePhone({ jwt: myJWT, phoneNumber: myPhoneNumber })
    })

    it('should send invalid http request and receive error response', async function () {
      const errorMessage = 'hubba bubba'
      try {
        mockBE.validatePhone = function validatePhone ({ jwt, phoneNumber }) {
          throw new Error(errorMessage)
        }
        await client.validatePhone({ jwt: undefined, phoneNumber: myPhoneNumber })
        assert.fail()
      } catch (e) {
        assert.match(e.message, /Error: hubba.*\n.*validatePhone.*\n.*code: -125/)
      }
    })
  })

  describe('createAccount', async function () {
    it('should send valid http request and receive valid response', async function () {
      const approvalData = 'I APPROVE'
      const smartAccountId = abi.soliditySHA3(['string'], ['fake@email.com'])
      mockBE.createAccount = function createAccount ({ jwt, smsCode, phoneNumber }) {
        assert.equal(jwt, myJWT)
        assert.equal(smsCode, mySmsCode)
        assert.equal(phoneNumber, myPhoneNumber)

        return { approvalData, smartAccountId: smartAccountId }
      }
      const res = await client.createAccount({ jwt: myJWT, smsCode: mySmsCode, phoneNumber: myPhoneNumber })
      assert.equal(res.approvalData, approvalData)
      assert.equal(Buffer.from(res.smartAccountId).toString('hex'), smartAccountId.toString('hex'))
    })

    it('should send invalid http request and receive error response', async function () {
      const errorMessage = 'go fish'
      try {
        mockBE.createAccount = function createAccount ({ jwt, smsCode, phoneNumber }) {
          throw new Error(errorMessage)
        }
        await client.createAccount({ jwt: undefined, smsCode: mySmsCode, phoneNumber: myPhoneNumber })
        assert.fail()
      } catch (e) {
        console.log(e)
        assert.match(e.message, /Error: go fish.*\n.*createAccount.*\n.*code: -125/)
      }
    })
  })

  describe('cancelChange', async function () {
    it('should send valid http request and receive valid response', async function () {
      mockWD.cancelChange = function cancelChange ({ smsCode, delayedOpId, address }) {
        assert.equal(smsCode, mySmsCode)
        assert.equal(delayedOpId, myDelayedOpId)
        assert.equal(address, myAddress)
      }
      await client.cancelChange({ delayedOpId: myDelayedOpId, smsCode: mySmsCode, address: myAddress })
    })

    it('should send invalid http request and throw on error response', async function () {
      const errorMessage = 'go fish'
      try {
        mockBE.cancelChange = function cancelChange ({ smsCode, delayedOpId, address }) {
          throw new Error(errorMessage)
        }
        await client.cancelChange({ jwt: undefined, smsCode: mySmsCode, phoneNumber: myPhoneNumber })
        assert.fail()
      } catch (e) {
        assert.match(e.message, /Error: go fish.*\n.*cancelChange.*\n.*code: -125/)
      }
    })
  })

  describe.skip('addOperatorNow', async function () {
    it('should send valid http request and receive valid response', async function () {
    })

    it('should send invalid http request and receive error response', async function () {
    })
  })

  after(async function () {
    server.stop()
  })
})

/* global describe it */

const { assert, expect } = require('chai')
const { SimpleManagerMock } = require('../mocks/SimpleManager.mock')

describe('Test Flows', () => {
  describe('create flow', async () => {
    const verbose = false
    const userEmail = 'user@email.com'
    let mgr, sms
    let jwt, phone

    it('create manager', () => {
      mgr = new SimpleManagerMock()
      sms = mgr.smsApi
    })

    it('new browser attempt login', async () => {
      assert.equal(await mgr.hasWallet(), false)
      assert.equal(mgr.getOwner(), null)
      assert.equal(mgr.getEmail(), null)
      assert.equal(await mgr.getWalletAddress(), null)

      // jwt is "opaque". we also get the plain values back.
      const { jwt: _jwt, email, address } = await mgr.googleLogin()
      jwt = _jwt

      expect(jwt).to.not.equal(null)
      assert.equal(email, userEmail) // only in mock...
      assert.equal(email, mgr.getEmail())
      assert.equal(address, mgr.getOwner())
    })

    it('after user inputs phone', async () => {
      phone = 'phoneNumber' // user input

      mgr.validatePhone({ jwt, phone })
    })

    it('after user receives SMS', async () => {
      const msg = await waitEvent(sms, 'mocksms')

      const smsVerificationCode = msg.message.match('verify=(.*)')[1]

      await mgr.createWallet({ jwt, phone, smsVerificationCode })
    })

    it('after wallet creation', async () => {
      const wallet = await mgr.loadWallet()

      assert.equal(wallet.getWalletInfo().address, await mgr.getWalletAddress())

      // todo: validate more wallet info..
    })

    function waitEvent (mgr, name) {
      return new Promise((resolve) => {
        if (verbose) { console.log('waiting for event: ', name) }
        mgr.on(name, result => {
          if (verbose) { console.log('after event ', name, result) }
          resolve(result)
        })
      })
    }
  })
})

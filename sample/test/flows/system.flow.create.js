/* global describe it before after */

import { assert, expect } from 'chai'
import SMSmock from '../../src/js/mocks/SMS.mock'
import TestEnvironment from '../utils/TestEnvironment'

import { increaseTime } from 'safechannels-contracts/test/utils'

const DAY = 24 * 3600

describe('System flow: Create Account', () => {
  let testEnvironment, web3, toBN

  before('check "gsn-dock-relay" is active', async function () {
    this.timeout(5000)
    testEnvironment = await TestEnvironment.initializeAndStartBackendForRealGSN({})
    web3 = testEnvironment.web3
    toBN = web3.utils.toBN
  })

  after('stop backend', async () => {
    await TestEnvironment.stopBackendServer()
  })

  let wallet

  describe('create flow with account', async () => {
    const userEmail = 'shahaf@tabookey.com'
    let mgr
    let jwt, phoneNumber

    before(async function () {
      mgr = testEnvironment.manager
    })

    it('new browser attempt login', async () => {
      assert.equal(await mgr.hasWallet(), false)
      // assert.equal(await mgr.getOwner(), null)
      assert.equal(await mgr.getEmail(), null)
      assert.equal(await mgr.getWalletAddress(), null)

      // jwt is "opaque". we also get the plain values back.
      const { jwt: _jwt, email, address } = await mgr.googleLogin()
      jwt = _jwt

      expect(jwt).to.match(/\w+/) // just verify there's something..
      assert.equal(email, userEmail) // only in mock...
      assert.equal(email, await mgr.getEmail())
      assert.equal(address, await mgr.getOwner())
    })

    it('after user inputs phone', async () => {
      phoneNumber = '+972541234567' // user input

      await mgr.validatePhone({ jwt, phoneNumber })
    })

    it('after user receives SMS', async () => {
      const msg = await SMSmock.asyncReadSms()

      assert.match(msg.message, /code.*\d{3,}/)
      const smsVerificationCode = msg.message.match(/(\d{3,})/)[1]

      wallet = await mgr.createWallet({ jwt, phoneNumber, smsVerificationCode })

      assert.equal(await mgr.getWalletAddress(), wallet.contract.address)
    })

    it('initialConfiguration', async () => {
      await mgr.setInitialConfiguration()

      console.log('wallet=', await wallet.getWalletInfo())
    })

    it('after wallet creation', async function () {
      const wallet = await mgr.loadWallet()

      const info = await wallet.getWalletInfo()
      assert.deepEqual(info.operators, [await mgr.getOwner()])
      assert.equal(info.unknownGuardians, 0)
    })
  })

  describe('transfer flow', async () => {
    let accounts

    before(async () => {
      assert.ok(wallet, 'no wallet for transfer tests')
      accounts = await web3.eth.getAccounts()
    })

    it('should have initial balance of 0', async () => {
      const tokens = await wallet.listTokens()
      const ethInfo = tokens.find(t => t.symbol === 'ETH')
      assert.equal(ethInfo.balance, '0')
    })
    it('balance should rise after funding wallet address', async () => {
      const val = 1.23e18.toString()
      const walletAddress = (await wallet.getWalletInfo()).address
      await web3.eth.sendTransaction({
        from: accounts[0],
        to: walletAddress,
        value: val
      })
      const tokens = await wallet.listTokens()
      const ethInfo = tokens.find(t => t.symbol === 'ETH')
      assert.equal(ethInfo.balance, val)
    })

    let pending
    it('should have pending event after transfer', async () => {
      const val = 0.5e18.toString()
      await wallet.transfer({ destination: accounts[0], amount: val, token: 'ETH' })
      const pendings = await wallet.listPendingTransactions()
      assert.equal(pendings.length, 1)
      pending = pendings[0]
      console.log('pending=', pending)
    })

    it('should remove pending request with cancelPending()', async () => {
      await wallet.cancelPending(pending.delayedOpId)
      const pendings = await wallet.listPendingTransactions()
      assert.equal(pendings.length, 0)
    })

    it('should be able to apply pending after transfer', async () => {
      const info = await wallet.getWalletInfo()

      const val = toBN(0.5e18)
      const currentBalance = await web3.eth.getBalance(info.address)
      await wallet.transfer({ destination: accounts[0], amount: val, token: 'ETH' })

      // TODO: currently, without getWalletInfo, the "applyAll" would fail...

      let pendings = await wallet.listPendingTransactions()
      assert.equal(pendings.length, 1)
      await increaseTime(3 * DAY, web3)
      await wallet.applyAllPendingOperations()
      pendings = await wallet.listPendingTransactions()
      assert.equal(pendings.length, 0)
      const finalBalance = await web3.eth.getBalance(info.address)

      // look ma, no fees!
      assert.equal(val.add(toBN(finalBalance)), currentBalance)
    })
  })
})

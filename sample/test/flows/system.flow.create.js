/* global describe it before after fail */

import axios from 'axios'
import { assert, expect } from 'chai'
import SMSmock from '../../src/js/mocks/SMS.mock'
import TestEnvironment from '../utils/TestEnvironment'

import { increaseTime } from 'safechannels-contracts/test/utils'
import { sleep } from '../backend/testutils'

const DAY = 24 * 3600

const verbose = true
describe('System flow: Create Account', () => {
  let testEnvironment, web3, toBN
  const userEmail = 'shahaf@tabookey.com'

  before('check "gsn-dock-relay" is active', async function () {
    this.timeout(7000)

    testEnvironment = await TestEnvironment.initializeAndStartBackendForRealGSN({ verbose })
    await testEnvironment.snapshot()
    web3 = testEnvironment.web3
    toBN = web3.utils.toBN
  })

  after('stop backend', async () => {
    console.log('before kill', (await axios.get('http://localhost:8090/getaddr')).data)
    TestEnvironment.stopBackendServer()
    await testEnvironment.revert()
    try {
      console.log('after kill relay', (await axios.get('http://localhost:8090/getaddr')).data)
      fail('server should be down!')
    } catch (e) {
      // ok
      console.log('expected after killing relay:', e.message)
    }
  })

  let wallet, mgr

  describe('create flow with account', async () => {
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
      const operators = info.participants.filter(it => it.type === 'operator')
      assert.deepEqual(operators.length, 1)
      assert.deepEqual(operators[0].address, await mgr.getOwner())
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

  describe('add device now', async () => {
    let newenv, newmgr
    let oldOperator
    before('create env for new device', async function () {
      this.timeout(10000)
      try {
        newenv = new TestEnvironment({})
        newenv.sponsor = testEnvironment.sponsor
        newenv.web3provider = testEnvironment.web3provider
        newenv.web3 = testEnvironment.web3
        newenv.verbose = testEnvironment.verbose
        newenv.factory = testEnvironment.factory
        newenv.backendAddresses = testEnvironment.backendAddresses

        await newenv._initializeSimpleManager()

        newmgr = newenv.manager

        oldOperator = await mgr.getOwner()
      } catch (e) {
        console.log('ex', e)
        throw e
      }
    })

    let smsCode, jwt
    const TEST_TITLE = 'title-of-new-device'

    it('signin from new device should get smsCode', async () => {
      const { jwt: _jwt, email, address } = await newmgr.googleLogin()
      jwt = _jwt

      // should have the same email as first mgr
      expect(email).to.equal(await mgr.getEmail())
      // but not the same owner address!
      expect(address).to.not.equal(oldOperator)

      await newmgr.signInAsNewOperator({ jwt, title: TEST_TITLE }) // TODO: use observer

      const msg = await SMSmock.asyncReadSms()
      assert.match(msg.message, /code.*?\d{3,}/)
      console.log('sms message', msg.message)
      smsCode = msg.message.match(/code.*?(\d{3,})/)[1]
      console.log('smsCode: ', smsCode)
    })

    let newOperator
    it('validateAddOperatorNow should return title and address', async () => {
      const { newOperatorAddress, title } = await wallet.validateAddOperatorNow({ jwt, smsCode })
      assert.equal(title, TEST_TITLE)
      assert.equal(newOperatorAddress, await newmgr.getOwner())
      newOperator = newOperatorAddress
    })

    it('addOperatorNow should add new operator..', async () => {
      assert.ok(!await wallet.isOperator(newOperator))

      let info = await wallet.getWalletInfo()
      assert.equal(info.participants.filter(p => p.type === 'operator').length, 1)
      await wallet.addOperatorNow(newOperator)

      await sleep(1000) // should be enough for guardian to complete.
      const events = await wallet.contract.getPastEvents('allevents', { fromBlock: 1, toBlock: 'latest' })
      const e = events.map(e => ({
        _event: e.event,
        ...fromEntries(Object.entries(e.returnValues).filter(x => x[0].match(/^\w./)))
      }))
      console.log('events=', e)

      // find "added" event (until Wallet will process it
      expect(events.filter(e => e.event === 'ParticipantAdded').length).to.equal(1)

      info = await wallet.getWalletInfo()
      console.log('participants:', info.participants)
      assert.equal(info.participants.filter(p => p.type === 'operator').length, 2)

      const newwallet = await newmgr.loadWallet()
      const newinfo = await newwallet.getWalletInfo()
      console.log('new participants', newinfo.participants)

      assert.ok(await newwallet.isOperator(newOperator))
    })
  })
})

// convert [ [key,val], [key,val] ] into {key:val, key:val}
// like the future standard Object.fromEntries
function fromEntries (entries) {
  return entries.reduce((obj, [key, val]) => {
    obj[key] = val
    return obj
  }, {})
}

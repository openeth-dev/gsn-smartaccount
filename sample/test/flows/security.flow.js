/* global describe it before after fail */

import axios from 'axios'
import { assert, expect } from 'chai'
import SMSmock from '../../src/js/mocks/SMS.mock'
import TestEnvironment from '../utils/TestEnvironment'
import SafeChannelUtils from 'safechannels-contracts/src/js/SafeChannelUtils'
import ChangeType from 'safechannels-contracts/test/etc/ChangeType'
import { increaseTime } from 'safechannels-contracts/test/utils'
import { sleep } from '../backend/testutils'
import Permissions from 'safechannels-contracts/src/js/Permissions'
import SmartAccountABI from 'safechannels-contracts/src/js/generated/SmartAccount'
import SimpleWallet from '../../src/js/impl/SimpleWallet'

const DAY = 24 * 3600
const verbose = false

describe('Security flow', () => {
  let testEnvironment, web3, toBN, accounts
  // const userEmail = 'shahaf@tabookey.com'
  let smartAccountContract

  before('check "gsn-dock-relay" is active', async function () {
    this.timeout(30000)

    testEnvironment = await TestEnvironment.initializeAndStartBackendForRealGSN({ verbose })
    await testEnvironment.snapshot()
    web3 = testEnvironment.web3
    toBN = web3.utils.toBN
    accounts = await web3.eth.getAccounts()
    smartAccountContract = new web3.eth.Contract(SmartAccountABI, '')
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
  let levelTwoAdmin1, levelTwoAdmin2, levelTwoAdmin3, levelTwoWatchdog1
  let levelTwoAdmin1Address, levelTwoAdmin2Address, levelTwoAdmin3Address, levelTwoWatchdog1Address

  describe('create flow with account', async () => {
    let jwt, phoneNumber

    before(async function () {
      mgr = testEnvironment.manager
    })

    it('setup account', async function () {
      phoneNumber = '+972541234567' // user input
      const { jwt: _jwt /*, email, address */ } = await mgr.googleLogin()
      jwt = _jwt
      await mgr.validatePhone({ jwt, phoneNumber })

      const msg = await SMSmock.asyncReadSms()

      assert.match(msg.message, /code.*\d{3,}/)
      const smsVerificationCode = msg.message.match(/(\d{3,})/)[1]

      wallet = await mgr.createWallet({ jwt, phoneNumber, smsVerificationCode })

      assert.equal(await mgr.getWalletAddress(), wallet.contract.address)
      smartAccountContract.options.address = wallet.contract.address
    })

    it('initialConfiguration', async () => {
      const userConfig = await SimpleWallet.getDefaultUserConfig()
      const config = await wallet.createInitialConfig({ userConfig })
      levelTwoAdmin1Address = accounts[4].toLowerCase()
      levelTwoAdmin2Address = accounts[5].toLowerCase()
      levelTwoAdmin3Address = accounts[6].toLowerCase()
      levelTwoWatchdog1Address = accounts[7].toLowerCase()
      levelTwoAdmin1 = '0x' +
        SafeChannelUtils.encodeParticipant({
          address: levelTwoAdmin1Address,
          permissions: Permissions.AdminPermissions,
          level: 2
        }).toString('hex')
      levelTwoAdmin2 = '0x' +
        SafeChannelUtils.encodeParticipant({
          address: levelTwoAdmin2Address,
          permissions: Permissions.AdminPermissions,
          level: 2
        }).toString('hex')
      levelTwoAdmin3 = '0x' +
        SafeChannelUtils.encodeParticipant({
          address: levelTwoAdmin3Address,
          permissions: Permissions.AdminPermissions,
          level: 2
        }).toString('hex')
      levelTwoWatchdog1 = '0x' +
        SafeChannelUtils.encodeParticipant({
          address: levelTwoWatchdog1Address,
          permissions: Permissions.WatchdogPermissions,
          level: 2
        }).toString('hex')
      config.initialParticipants.push(
        levelTwoAdmin1,
        levelTwoAdmin2,
        levelTwoAdmin3,
        levelTwoWatchdog1
      )
      await wallet.initialConfiguration(config)
      const info = await wallet.getWalletInfo()
      const operators = info.participants.filter(p => p.type === 'operator')
      const admins = info.participants.filter(p => p.type === 'admin').map(e => e.address)
      const watchdogs = info.participants.filter(p => p.type === 'watchdog').map(e => e.address)
      assert.deepEqual(operators.length, 1)
      assert.deepEqual(operators[0].address, await mgr.getOwner())

      assert.isTrue(admins.includes(levelTwoAdmin1Address), 'levelTwoAdmin1 not participant')
      assert.isTrue(admins.includes(levelTwoAdmin2Address), 'levelTwoAdmin2 not participant')
      assert.isTrue(admins.includes(levelTwoAdmin3Address), 'levelTwoAdmin3 not participant')
      assert.isTrue(watchdogs.includes(levelTwoWatchdog1Address), 'levelTwoWatchdog1 not participant')
    })
  })

  describe('auto cancelling watchdog', async function () {
    before('restart server with auto cancel', async function () {
      TestEnvironment.stopBackendServer(false)
      const ret = await testEnvironment.startBackendServer({ autoCancel: true })
      assert.isTrue(ret.autoCancel, 'autoCancel not set correctly')
      console.log('ret is', ret, '\n')
    })
    it('try transfer and see it gets cancelled by watchdog', async function () {
      await wallet.getWalletInfo()
      const val = toBN(0.5e18)
      const eventsBefore = await wallet.contract.getPastEvents('BypassCallCancelled', { fromBlock: 0 })
      const receipt = await wallet.transfer({ destination: accounts[0], amount: val, token: 'ETH' })
      const args = receipt.logs[0].args
      const delayedOpId = args.delayedOpId
      console.log('delayedOpId in receipt is', delayedOpId)
      await increaseTime(3 * DAY, web3)
      await sleep(1500)
      try {
        await wallet.contract.applyBypassCall(
          wallet.participant.permLevel,
          args.sender,
          args.senderPermsLevel,
          args.stateId,
          args.target,
          args.value,
          args.msgdata || [],
          { from: wallet.participant.address }
        )
        assert.fail()
      } catch (e) {
        assert.isTrue(e.message.includes('non existent pending bypass call'), e)
      }
      const eventsAfter = await wallet.contract.getPastEvents('BypassCallCancelled', { fromBlock: 0 })
      assert.equal(eventsAfter.length, eventsBefore.length + 1, 'No BypassCallCancelled event found')
    })
    it('freeze level 1 by level 2 watchdog ', async function () {
      const receipt = await smartAccountContract.methods.freeze(
        SafeChannelUtils.packPermissionLevel(Permissions.WatchdogPermissions, 2),
        1,
        14 * DAY
      ).send({ from: levelTwoWatchdog1Address })
      assert.equal(receipt.events.LevelFrozen.event, 'LevelFrozen')
    })
    it('revert transfers on frozen account', async function () {
      try {
        await wallet.transfer({ destination: accounts[0], amount: 1, token: 'ETH' })
        assert.fail()
      } catch (e) {
        assert.isTrue(e.message.includes('level is frozen'), e)
      }
    })
    after('stop auto cancelling watchdog', async function () {
      TestEnvironment.stopBackendServer(false)
    })
  })

  describe('recover device by level 2 admins with approvals', async function () {
    let oldOperator, newOperator, stateId, addOperatorPendingChangeArgs
    before('create env for new device', async function () {
      this.timeout(10000)
      oldOperator = await mgr.getOwner()
      newOperator = accounts[9]
    })

    it('schedule add new operator by admin', async function () {
      stateId = await smartAccountContract.methods.stateNonce().call()
      const receipt = await smartAccountContract.methods.scheduleAddOperator(
        SafeChannelUtils.packPermissionLevel(Permissions.AdminPermissions, 2),
        newOperator,
        stateId
      ).send({ from: levelTwoAdmin1Address })
      addOperatorPendingChangeArgs = receipt.events.ConfigPending.returnValues
      assert.equal(addOperatorPendingChangeArgs[7][0].slice(26), newOperator.toLowerCase().slice(2))
      assert.equal(addOperatorPendingChangeArgs[6], ChangeType.ADD_OPERATOR)
    })

    it('approve and apply add operator by another admin', async function () {
      const args = [
        addOperatorPendingChangeArgs[6],
        addOperatorPendingChangeArgs[7],
        addOperatorPendingChangeArgs[8],
        addOperatorPendingChangeArgs[5],
        addOperatorPendingChangeArgs[1],
        addOperatorPendingChangeArgs[2],
        addOperatorPendingChangeArgs[3],
        addOperatorPendingChangeArgs[4]]
      try {
        await smartAccountContract.methods.applyConfig(
          SafeChannelUtils.packPermissionLevel(Permissions.AdminPermissions, 2),
          ...args).send({ from: levelTwoAdmin2Address })
      } catch (e) {
        assert.isTrue(e.message.includes('before due time'), e)
      }
      await increaseTime(4 * DAY, web3)
      try {
        await smartAccountContract.methods.applyConfig(
          SafeChannelUtils.packPermissionLevel(Permissions.AdminPermissions, 2),
          ...args).send({ from: levelTwoAdmin2Address })
      } catch (e) {
        assert.isTrue(e.message.includes('Pending approvals'), e)
      }
      await smartAccountContract.methods.approveConfig(
        SafeChannelUtils.packPermissionLevel(Permissions.WatchdogPermissions, 2),
        ...args).send({ from: levelTwoWatchdog1Address, gas: 1e8 })
      await smartAccountContract.methods.applyConfig(
        SafeChannelUtils.packPermissionLevel(Permissions.AdminPermissions, 2),
        ...args).send({ from: levelTwoAdmin2Address, gas: 1e8 })
    })

    it('remove old participants and unfreeze by boosted operator', async function () {
      const actions = [ChangeType.REMOVE_PARTICIPANT, ChangeType.UNFREEZE]
      const args = [
        '0x' + SafeChannelUtils.encodeParticipant({
          address: oldOperator,
          permissions: Permissions.OwnerPermissions,
          level: 1
        }).toString('hex'),
        '0x0']
      const stateId = await smartAccountContract.methods.stateNonce().call()
      const encodedHash = '0x' + SafeChannelUtils.changeHash(actions, args, args, stateId).toString('hex')
      const signature = await SafeChannelUtils.signMessage(encodedHash, web3, { from: newOperator })
      await smartAccountContract.methods.boostedConfigChange(
        SafeChannelUtils.packPermissionLevel(Permissions.AdminPermissions, 2),
        actions,
        args,
        args,
        stateId,
        SafeChannelUtils.packPermissionLevel(Permissions.OwnerPermissions, 1),
        signature
      ).send({ from: levelTwoAdmin1Address, gas: 1e8 })
      await increaseTime(2 * DAY, web3)
      const receipt = await smartAccountContract.methods.applyConfig(
        SafeChannelUtils.packPermissionLevel(Permissions.AdminPermissions, 2),
        actions,
        args,
        args,
        stateId,
        newOperator,
        SafeChannelUtils.packPermissionLevel(Permissions.OwnerPermissions, 1),
        levelTwoAdmin1Address,
        SafeChannelUtils.packPermissionLevel(Permissions.AdminPermissions, 2)
      ).send({ from: levelTwoAdmin1Address, gas: 1e8 })
      assert.equal(receipt.events.ParticipantRemoved.event, 'ParticipantRemoved')
      assert.equal(receipt.events.ParticipantRemoved.returnValues[0].toLowerCase(), oldOperator.toLowerCase())
      assert.equal(receipt.events.UnfreezeCompleted.event, 'UnfreezeCompleted')
    })

    it('revert on transfer from old operator', async function () {
      await wallet.getWalletInfo()
      try {
        await wallet.transfer({ destination: accounts[0], amount: 1, token: 'ETH' })
        assert.fail()
      } catch (e) {
        assert.isTrue(e.message.includes('not participant'), e)
      }
    })
    it('transfer eth from new operator', async function () {
      const balanceBefore = parseInt(await web3.eth.getBalance(levelTwoWatchdog1Address))
      const stateId = await smartAccountContract.methods.stateNonce().call()
      await smartAccountContract.methods.scheduleBypassCall(
        SafeChannelUtils.packPermissionLevel(Permissions.OwnerPermissions, 1),
        levelTwoWatchdog1Address,
        1e3,
        [],
        stateId
      ).send({ from: newOperator })
      await increaseTime(2 * DAY, web3)
      await smartAccountContract.methods.applyBypassCall(
        SafeChannelUtils.packPermissionLevel(Permissions.OwnerPermissions, 1),
        newOperator,
        SafeChannelUtils.packPermissionLevel(Permissions.OwnerPermissions, 1),
        stateId,
        levelTwoWatchdog1Address,
        1e3,
        []
      ).send({ from: newOperator })
      const balanceAfter = parseInt(await web3.eth.getBalance(levelTwoWatchdog1Address))
      assert.equal(balanceAfter, balanceBefore + 1e3)
    })
  })
})

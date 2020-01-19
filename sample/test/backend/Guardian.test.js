/* global describe before after it */

import { assert } from 'chai'
import Web3 from 'web3'
import SMSmock from '../../src/js/mocks/SMS.mock'
import { Admin, AutoCancelWatchdog, Watchdog } from '../../src/js/backend/Guardian'
import { KeyManager } from '../../src/js/backend/KeyManager'
import FactoryContractInteractor from 'safechannels-contracts/src/js/FactoryContractInteractor'
import { AccountManager } from '../../src/js/backend/AccountManager'
import { SmsManager } from '../../src/js/backend/SmsManager'
import crypto from 'crypto'
import SimpleWallet from '../../src/js/impl/SimpleWallet'
import Participant from 'safechannels-contracts/src/js/Participant'
import Permissions from 'safechannels-contracts/src/js/Permissions'
import scutils from 'safechannels-contracts/src/js/SafeChannelUtils'
import sctestutils from 'safechannels-contracts/test/utils'
import ChangeType from 'safechannels-contracts/test/etc/ChangeType'
import abiDecoder from 'abi-decoder'
import { Backend } from '../../src/js/backend/Backend'
import { generateMockJwt, hookFunction, unhookFunction, urlPrefix } from './testutils'

require('../../src/js/mocks/MockDate')

describe('As Guardian', async function () {
  let web3
  let id
  let watchdog
  let backend
  let admin
  let smsProvider
  const keypair = {
    privateKey: Buffer.from('20e12d5dc484a03c969d48446d897a006ebef40a806dab16d58db79ba64aa01f', 'hex'),
    address: '0x68cc521201a7f8617c5ce373b0f0993ee665ef63'
  }
  let keyManager
  let smsManager
  let accountManager
  const ethNodeUrl = 'http://localhost:8545'
  let accounts
  let accountZero //= '0x90f8bf6a479f320ead074411a4b0e7944ea8c9c1'
  let web3provider
  let smartAccount
  let smartAccountFactory
  let smartAccountId
  let walletConfig
  let wallet
  const transferDestination = '0x1234567891111111111111111111111111111111'
  const newOperatorAddress = '0x1234567892222222222222222222222222222222'
  const wrongOperatorAddress = '0x1234567892222222222222222222222222222223'
  const amount = 1e3
  let config
  let newAccount
  const audience = '202746986880-u17rbgo95h7ja4fghikietupjknd1bln.apps.googleusercontent.com'
  const email = 'someone@somewhere.com'
  let nonce
  const phoneNumber = '+972541234567'
  let newSmartAccountReceipt

  before(async function () {
    this.timeout(30000)
    web3provider = new Web3.providers.WebsocketProvider(ethNodeUrl)
    web3 = new Web3(web3provider)
    web3.eth.net.isListening(function (error, result) {
      if (error) console.log('error listening', error)
    })
    id = (await sctestutils.snapshot(web3)).result
    accounts = await web3.eth.getAccounts()
    accountZero = accounts[0]
    const mockHub = await FactoryContractInteractor.deployMockHub(accountZero, ethNodeUrl)
    const sponsor = await FactoryContractInteractor.deploySponsor(accountZero, mockHub.address, ethNodeUrl)
    await sponsor.relayHubDeposit({ value: 2e18, from: accountZero, gas: 1e5 })
    const forwarderAddress = await sponsor.getGsnForwarder()
    smartAccountFactory = await FactoryContractInteractor.deployNewSmartAccountFactory(accountZero, ethNodeUrl,
      forwarderAddress)
    smsProvider = new SMSmock()
    smsManager = new SmsManager({ smsProvider, secretSMSCodeSeed: crypto.randomBytes(32) })
    accountManager = new AccountManager({ workdir: '/tmp/test/guaridan' })
    const backendKM = new KeyManager({ ecdsaKeyPair: KeyManager.newKeypair() })
    backend = new Backend(
      {
        smsManager,
        audience,
        keyManager: backendKM,
        accountManager
      })
    await smartAccountFactory.addTrustedSigners([backend.keyManager.address()], { from: accountZero })
    const jwt = generateMockJwt({ email, nonce })
    const smsCode = await backend.smsManager.getSmsCode({ phoneNumber: backend._formatPhoneNumber(phoneNumber), email })
    backend._getTicketFromJWT = () => {
      return { getPayload: () => { return { email } } }
    }
    let approvalData
    ({ approvalData, smartAccountId } = await backend.createAccount({ jwt, smsCode, phoneNumber }))
    newAccount = await backend.accountManager.getAccountById({ accountId: smartAccountId })
    newSmartAccountReceipt = await smartAccountFactory.newSmartAccount(smartAccountId, approvalData,
      { from: accountZero })
    smartAccount = await FactoryContractInteractor.getCreatedSmartAccountAt(
      { address: newSmartAccountReceipt.logs[0].args.smartAccount, provider: web3provider })
    walletConfig = {
      contract: smartAccount,
      participant:
        new Participant(accountZero, Permissions.OwnerPermissions, 1),
      knownParticipants: [
        new Participant(accountZero, Permissions.OwnerPermissions, 1),
        new Participant(keypair.address, Permissions.WatchdogPermissions, 1),
        new Participant(keypair.address, Permissions.AdminPermissions, 1)
      ]
    }
    wallet = new SimpleWallet(walletConfig)
    config = SimpleWallet.getDefaultSampleInitialConfiguration({
      backendAddress: keypair.address,
      operatorAddress: accountZero
    })
    config.initialDelays = [1, 1]
    config.requiredApprovalsPerLevel = [0, 0]
    await wallet.initialConfiguration(config)
    await web3.eth.sendTransaction({
      from: accountZero,
      value: 1e18,
      to: wallet.contract.address,
      gasPrice: 1
    })
  })

  after(async function () {
    await accountManager.clearAll()
    await sctestutils.revert(id, web3)
  })

  describe('As Watchdog', async function () {
    let receipt
    let actions
    let args

    before(async function () {
      await web3.eth.sendTransaction({
        from: accountZero,
        value: 1e18,
        to: keypair.address,
        gasPrice: 1
      })
    })

    it('should construct Watchdog', async function () {
      keyManager = new KeyManager({ ecdsaKeyPair: keypair })
      watchdog = new Watchdog(
        {
          smsManager,
          keyManager,
          accountManager,
          smartAccountFactoryAddress: smartAccountFactory.address,
          web3provider,
          urlPrefix
        })
      assert.isTrue(await wallet.contract.isParticipant(watchdog.address,
        watchdog.permsLevel))
      actions = [ChangeType.ADD_PARTICIPANT]
      args = [scutils.encodeParticipant({
        address: watchdog.address,
        permissions: Permissions.WatchdogPermissions,
        level: 1
      })]
    })

    it('should NOT add address to known account after smartAccountCreated from unknown factory', async function () {
      assert.equal(undefined,
        (await watchdog.accountManager.getAccountById({ accountId: newAccount.accountId })).address)
      watchdog.smartAccountFactoryAddress = accountZero
      await watchdog._worker()
      watchdog.lastScannedBlock = 0
      watchdog.smartAccountFactoryAddress = smartAccountFactory.address
      assert.equal(undefined,
        (await watchdog.accountManager.getAccountById({ accountId: newAccount.accountId })).address)
    })

    it('should add address to known account after smartAccountCreated event', async function () {
      assert.equal(undefined,
        (await watchdog.accountManager.getAccountById({ accountId: newAccount.accountId })).address)
      await watchdog._worker()
      newAccount = await backend.accountManager.getAccountById({ accountId: smartAccountId })
      assert.equal(wallet.contract.address.toLowerCase(), newAccount.address)
    })

    const delayedOps = ['BypassCall', 'Config']
    delayedOps.forEach(function (delayedOp) {
      it(`should not apply delayed ${delayedOp} for unknown accounts`, async function () {
        await watchdog.accountManager.removeAccount({ account: newAccount })
        const stateId = await wallet.contract.stateNonce()
        if (delayedOp === 'BypassCall') {
          receipt = await wallet.contract.scheduleBypassCall(wallet.participant.permLevel, transferDestination, amount,
            [],
            stateId,
            { from: accountZero })
        } else {
          receipt = await wallet.contract.changeConfiguration(wallet.participant.permLevel, actions, args, args,
            stateId,
            { from: accountZero })
        }
        assert.equal(receipt.logs[0].event, delayedOp + 'Pending')
        const eventsBefore = await wallet.contract.getPastEvents(delayedOp + 'Applied')
        await watchdog._worker()
        const eventsAfter = await wallet.contract.getPastEvents(delayedOp + 'Applied')
        assert.equal(eventsAfter.length, eventsBefore.length)
      })

      it(`should not cancel delayed ${delayedOp} for unknown accounts`, async function () {
        const smsCode = watchdog.smsManager.getSmsCode(
          { phoneNumber: newAccount.phone, email: newAccount.email })
        const url = `${urlPrefix}&delayedOpId=${receipt.logs[0].args.delayedOpId}&address=${newAccount.address}&smsCode=${smsCode}`
        try {
          await watchdog.cancelByUrl(
            { jwt: undefined, url })
          assert.fail()
        } catch (e) {
          assert.equal(e.message,
            'Unknown account: either the account was not created on the backend or no address found from smartAccountCreated event')
        }
      })

      it(`should cancel delayed ${delayedOp} for a known account`, async function () {
        await watchdog.accountManager.putAccount({ account: newAccount })
        const eventsBefore = await wallet.contract.getPastEvents(delayedOp + 'Cancelled')
        const smsCode = watchdog.smsManager.getSmsCode(
          { phoneNumber: newAccount.phone, email: newAccount.email })
        hookFunction(watchdog, watchdog._applyChanges.name, function () {})
        watchdog.lastScannedBlock = 0
        await watchdog._worker()
        unhookFunction(watchdog, watchdog._applyChanges.name)
        const url = `${urlPrefix}&delayedOpId=${receipt.logs[0].args.delayedOpId}&address=${newAccount.address}&smsCode=${smsCode}`
        const txhash = (await watchdog.cancelByUrl(
          { jwt: undefined, url })).transactionHash
        const rawReceipt = await web3.eth.getTransactionReceipt(txhash)
        const dlogs = abiDecoder.decodeLogs(rawReceipt.logs)
        assert.equal(dlogs[0].name, delayedOp + 'Cancelled')
        assert.equal(dlogs[0].events[0].value, receipt.logs[0].args.delayedOpId)
        const eventsAfter = await wallet.contract.getPastEvents(delayedOp + 'Cancelled')
        assert.equal(eventsAfter.length, eventsBefore.length + 1)
      })

      it(`should apply delayed ${delayedOp} for a known account`, async function () {
        this.timeout(10000)
        const stateId = await wallet.contract.stateNonce()
        if (delayedOp === 'BypassCall') {
          await wallet.contract.scheduleBypassCall(wallet.participant.permLevel, transferDestination, amount, [],
            stateId,
            { from: accountZero })
        } else {
          await wallet.contract.changeConfiguration(wallet.participant.permLevel, actions, args, args, stateId,
            { from: accountZero })
        }

        const eventsBefore = await wallet.contract.getPastEvents(delayedOp + 'Applied')
        let gotSms = false
        watchdog.smsManager.smsProvider.once('mocksms', () => { gotSms = true })
        await watchdog._worker()
        const eventsDuring = await wallet.contract.getPastEvents(delayedOp + 'Applied')
        assert.equal(eventsDuring.length, eventsBefore.length)
        assert.isTrue(gotSms)
        Date.setMockedTime(Date.realNow() + 1e7)
        await sctestutils.increaseTime(1e3, web3)
        await watchdog._worker()
        Date.mockedDateOffset = 0
        const eventsAfter = await wallet.contract.getPastEvents(delayedOp + 'Applied')
        assert.equal(eventsAfter.length, eventsBefore.length + 1)
        assert.deepEqual(watchdog.changesToApply, {})
      })
    })

    it('should NOT approve addOperatorNow for unknown accounts', async function () {
      // const id = (await sctestutils.snapshot(web3)).result
      await watchdog.accountManager.removeAccount({ account: newAccount })
      const stateId = await wallet.contract.stateNonce()
      receipt = await wallet.contract.addOperatorNow(wallet.participant.permLevel, newOperatorAddress, stateId,
        { from: accountZero })
      assert.equal(receipt.logs[0].event, 'ConfigPending')
      assert.equal(receipt.logs[0].args.actions[0], ChangeType.ADD_OPERATOR_NOW.toString())
      const eventsBefore = await wallet.contract.getPastEvents('ConfigApplied')
      await watchdog._worker()
      const eventsAfter = await wallet.contract.getPastEvents('ConfigApplied')
      assert.equal(eventsAfter.length, eventsBefore.length)
      // sctestutils.revert(id, web3)
    })

    it('should NOT approve addOperatorNow for unknown requests', async function () {
      await watchdog.accountManager.putAccount({ account: newAccount })
      const stateId = await wallet.contract.stateNonce()
      receipt = await wallet.contract.addOperatorNow(wallet.participant.permLevel, newOperatorAddress, stateId,
        { from: accountZero })
      assert.equal(receipt.logs[0].event, 'ConfigPending')
      assert.equal(receipt.logs[0].args.actions[0], ChangeType.ADD_OPERATOR_NOW.toString())
      const ret = await watchdog._worker()
      assert.equal(ret[0].message, `Cannot find new operator address of accountId ${newAccount.accountId}`)
    })

    it('should NOT approve addOperatorNow on participant hash mismatch', async function () {
      await watchdog.accountManager.putOperatorToAdd({ accountId: newAccount.accountId, address: wrongOperatorAddress })
      const stateId = await wallet.contract.stateNonce()
      receipt = await wallet.contract.addOperatorNow(wallet.participant.permLevel, newOperatorAddress, stateId,
        { from: accountZero })
      assert.equal(receipt.logs[0].event, 'ConfigPending')
      assert.equal(receipt.logs[0].args.actions[0], ChangeType.ADD_OPERATOR_NOW.toString())
      const ret = await watchdog._worker()
      assert.equal(ret[0].message,
        `participant hash mismatch:\nlog ${receipt.logs[0].args.actionsArguments1[0]}\nexpected operator hash ${scutils.bufferToHex(
          scutils.encodeParticipant({
            address: wrongOperatorAddress,
            permissions: Permissions.OwnerPermissions,
            level: 1
          }))}`)
      await watchdog.accountManager.removeOperatorToAdd({ accountId: newAccount.accountId })
    })

    it('should approve addOperatorNow for known requests', async function () {
      await watchdog.accountManager.putOperatorToAdd({ accountId: newAccount.accountId, address: newOperatorAddress })
      const stateId = await wallet.contract.stateNonce()
      receipt = await wallet.contract.addOperatorNow(wallet.participant.permLevel, newOperatorAddress, stateId,
        { from: accountZero })
      assert.equal(receipt.logs[0].event, 'ConfigPending')
      assert.equal(receipt.logs[0].args.actions[0], ChangeType.ADD_OPERATOR_NOW.toString())
      const eventsBefore = await wallet.contract.getPastEvents('ConfigApplied')
      const ret = await watchdog._worker()
      const dlogs = abiDecoder.decodeLogs(ret[0].logs)
      assert.equal(dlogs[0].name, 'ConfigApplied')
      assert.equal(dlogs[0].events[0].value, receipt.logs[0].args.delayedOpId)
      assert.equal(dlogs[1].name, 'ParticipantAdded')
      const eventsAfter = await wallet.contract.getPastEvents('ConfigApplied')
      assert.equal(eventsAfter.length, eventsBefore.length + 1)
    })

    it('should not apply any operation twice', async function () {
      hookFunction(watchdog, watchdog._sendTransaction.name, function () {
        assert.fail()
      })
      watchdog.lastScannedBlock = 0
      watchdog.smsManager.smsProvider.once('mocksms', function (sms) {
        console.log('GOT SMS', sms)
        assert.fail()
      })
      await watchdog._worker()
      assert.deepEqual(watchdog.changesToApply, {})
      await watchdog.accountManager.putOperatorToAdd({ accountId: newAccount.accountId, address: wrongOperatorAddress })
      watchdog.lastScannedBlock = 0
      await watchdog._worker()
      assert.deepEqual(watchdog.changesToApply, {})
      unhookFunction(watchdog, watchdog._sendTransaction.name)
    })

    it('should start periodic task and subscribe to new blocks', async function () {
      let blockHeader = {}
      hookFunction(watchdog, watchdog._worker.name, function (bh) {
        blockHeader = bh
      })
      await watchdog.start()
      await sctestutils.evmMine(web3)
      const exampleHeader = {
        hash: undefined,
        parentHash: undefined,
        sha3Uncles: undefined,
        miner: undefined,
        stateRoot: undefined,
        transactionsRoot: undefined,
        receiptsRoot: undefined,
        logsBloom: undefined,
        difficulty: undefined,
        number: undefined,
        gasLimit: undefined,
        gasUsed: undefined,
        nonce: undefined,
        mixHash: undefined,
        timestamp: undefined,
        extraData: undefined,
        size: undefined
      }
      assert.deepEqual(Object.keys(blockHeader).sort(), Object.keys(exampleHeader).sort())
      unhookFunction(watchdog, watchdog._worker.name)
    })
    it('should stop periodic task and unsubscribe from new blocks', async function () {
      await watchdog.stop()
    })
  })

  describe('As Admin', async function () {
    let id
    before(async function () {
      admin = new Admin(
        { smsManager, keyManager, accountManager, smartAccountFactoryAddress: accountZero, web3provider })
      id = (await sctestutils.snapshot(web3)).result
    })
    it('should throw trying schedule add operator on unknown account', async function () {
      try {
        await watchdog.accountManager.removeAccount({ account: newAccount })
        await admin.scheduleAddOperator({ accountId: newAccount.accountId, newOperatorAddress })
        assert.fail()
      } catch (e) {
        assert.equal(e.message, 'Account not found')
      }
    })
    it('should throw trying schedule add operator on account without address', async function () {
      const address = newAccount.address
      delete newAccount.address
      await watchdog.accountManager.putAccount({ account: newAccount })
      try {
        await admin.scheduleAddOperator({ accountId: newAccount.accountId, newOperatorAddress })
        assert.fail()
      } catch (e) {
        assert.equal(e.message, 'Account address is not set yet')
      }
      newAccount.address = address
      await watchdog.accountManager.putAccount({ account: newAccount })
    })
    it('should schedule add operator', async function () {
      const { transactionHash } = await admin.scheduleAddOperator(
        { accountId: newAccount.accountId, newOperatorAddress })
      const receipt = await web3.eth.getTransactionReceipt(transactionHash)
      const dlogs = abiDecoder.decodeLogs(receipt.logs)
      assert.equal(dlogs[0].name, 'ConfigPending')
      assert.equal(dlogs[0].events[6].name, 'actions')
      assert.equal(dlogs[0].events[6].value, ChangeType.ADD_OPERATOR)
    })
    after(async function () {
      await sctestutils.revert(id, web3)
    })
  })

  describe('As AutoCancelWatchdog', async function () {
    let autoCancelWatchdog
    before(async function () {
      autoCancelWatchdog = new AutoCancelWatchdog(
        {
          smsManager,
          keyManager,
          accountManager,
          smartAccountFactoryAddress: smartAccountFactory.address,
          web3provider,
          urlPrefix
        })
      autoCancelWatchdog.lastScannedBlock = watchdog.lastScannedBlock
    })
    it('should auto cancel pending changes', async function () {
      const stateId = await wallet.contract.stateNonce()
      const receipt = await wallet.contract.scheduleBypassCall(wallet.participant.permLevel, transferDestination,
        amount,
        [],
        stateId,
        { from: accountZero })
      assert.equal(receipt.logs[0].event, 'BypassCallPending')
      const eventsBefore = await wallet.contract.getPastEvents('BypassCallCancelled')
      const txreceipts = await autoCancelWatchdog._worker()
      const eventsAfter = await wallet.contract.getPastEvents('BypassCallCancelled')
      assert.equal(eventsAfter.length, eventsBefore.length + 1)
      const dlogs = abiDecoder.decodeLogs(txreceipts[0].logs)
      assert.equal(dlogs[0].name, 'BypassCallCancelled')
      assert.equal(dlogs[0].events[0].name, 'delayedOpId')
      assert.equal(dlogs[0].events[0].value, receipt.logs[0].args.delayedOpId)
    })
  })
})

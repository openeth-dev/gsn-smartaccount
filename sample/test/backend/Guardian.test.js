/* global describe before it */

import { assert } from 'chai'
import Web3 from 'web3'
import SMSmock from '../../src/js/mocks/SMS.mock'
import { Watchdog } from '../../src/js/backend/Guardian'
import { KeyManager } from '../../src/js/backend/KeyManager'
import FactoryContractInteractor from 'safechannels-contracts/src/js/FactoryContractInteractor'
import { BackendAccount, AccountManager } from '../../src/js/backend/AccountManager'
import { SmsManager } from '../../src/js/backend/SmsManager'
import crypto from 'crypto'
import SimpleWallet from '../../src/js/impl/SimpleWallet'
import Participant from 'safechannels-contracts/src/js/Participant'
import Permissions from 'safechannels-contracts/src/js/Permissions'
import scutils from 'safechannels-contracts/src/js/SafeChannelUtils'
import sctestutils from 'safechannels-contracts/test/utils'
import ChangeType from 'safechannels-contracts/test/etc/ChangeType'
// import { sleep } from './testutils'

// const ethUtils = require('ethereumjs-util')
// const abi = require('ethereumjs-abi')
// const phone = require('phone')

describe('As Guardian', async function () {
  let web3
  let watchdog
  let smsProvider
  const keypair = {
    privateKey: Buffer.from('20e12d5dc484a03c969d48446d897a006ebef40a806dab16d58db79ba64aa01f', 'hex'),
    address: '0x68cc521201a7f8617c5ce373b0f0993ee665ef63'
  }
  let keyManager
  let smsManager
  let accountManager
  const ethNodeUrl = 'http://localhost:8545'
  let accountZero //= '0x90f8bf6a479f320ead074411a4b0e7944ea8c9c1'
  let web3provider
  let smartAccount
  let walletConfig
  let wallet
  const whitelistPolicy = '0x1111111111111111111111111111111111111111'
  const transferDestination = '0x1234567891111111111111111111111111111111'
  const amount = 1e3
  let config
  let newAccount

  async function fundAddress (guardianAddress) {
    const tx = {
      from: accountZero,
      value: 1e18,
      to: guardianAddress,
      gasPrice: 1
    }
    const receipt = await web3.eth.sendTransaction(tx)
    console.log(`Funded address ${guardianAddress}, txhash ${receipt.transactionHash}\n`)
  }

  before(async function () {
    web3provider = new Web3.providers.WebsocketProvider(ethNodeUrl)
    web3 = new Web3(web3provider)
    accountZero = (await web3.eth.getAccounts())[0]
    smartAccount = await FactoryContractInteractor.deploySmartAccountDirectly(accountZero, ethNodeUrl)
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
      operatorAddress: accountZero,
      whitelistModuleAddress: whitelistPolicy
    })
    // config.initialDelays = [1, 1]
    config.initialDelays = [0, 0]
    config.requiredApprovalsPerLevel = [0, 0]
    await wallet.initialConfiguration(config)
    await fundAddress(wallet.contract.address)
    newAccount = new BackendAccount({
      accountId: '123456',
      email: '',
      phone: '',
      verified: true,
      address: wallet.contract.address
    })
  })

  describe('As Watchdog', async function () {
    let receipt
    let actions
    let args

    function hookWatchdogFunction (funcName, newFunc) {
      Object.defineProperty(newFunc, 'name', {
        writable: true,
        value: funcName
      })
      watchdog[funcName + 'Orig'] = watchdog[funcName]
      watchdog[funcName] = newFunc
    }

    function unhookWatchdogFunction (funcName) {
      watchdog[funcName] = watchdog[funcName + 'Orig']
      delete watchdog[funcName + 'Orig']
    }

    before(async function () {
      await fundAddress(keypair.address)
    })

    it('should construct Watchdog', async function () {
      smsProvider = new SMSmock()
      smsManager = new SmsManager({ smsProvider, secretSMSCodeSeed: crypto.randomBytes(32) })
      keyManager = new KeyManager({ ecdsaKeyPair: keypair })
      accountManager = new AccountManager()
      watchdog = new Watchdog(
        { smsManager, keyManager, accountManager, smartAccountFactoryAddress: accountZero, web3provider })
      assert.isTrue(await wallet.contract.isParticipant(watchdog.address,
        watchdog.permsLevel))
      actions = [ChangeType.ADD_PARTICIPANT]
      args = [scutils.participantHash(watchdog.address, watchdog.permsLevel)]
    })

    const delayedOps = ['BypassCall', 'Config']
    delayedOps.forEach(function (delayedOp) {
      it(`should not apply delayed ${delayedOp} for unknown accounts`, async function () {
        watchdog.accountManager.removeAccount({ account: newAccount })
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

      it(`should cancel delayed ${delayedOp} for a known account`, async function () {
        watchdog.accountManager.putAccount({ account: newAccount })
        const eventsBefore = await wallet.contract.getPastEvents(delayedOp + 'Cancelled')
        const smsCode = watchdog.smsManager.getSmsCode(
          { phoneNumber: newAccount.phone, email: newAccount.email })
        hookWatchdogFunction(watchdog._applyChanges.name, function () {})
        await watchdog._worker()
        unhookWatchdogFunction(watchdog._applyChanges.name)
        receipt = await watchdog.cancelChange(
          { smsCode, delayedOpId: receipt.logs[0].args.delayedOpId, address: newAccount.address })
        const eventsAfter = await wallet.contract.getPastEvents(delayedOp + 'Cancelled')
        assert.equal(eventsAfter.length, eventsBefore.length + 1)
      })

      it(`should apply delayed ${delayedOp} for a known account`, async function () {
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
        await watchdog._worker()
        const eventsAfter = await wallet.contract.getPastEvents(delayedOp + 'Applied')
        assert.equal(eventsAfter.length, eventsBefore.length + 1)
        assert.deepEqual(watchdog.changesToApply, {})
      })
    })

    it('should not apply any operation twice', async function () {
      hookWatchdogFunction(watchdog._applyChanges.name, function () {})
      watchdog.lastScannedBlock = 0
      await watchdog._worker()
      assert.deepEqual(watchdog.changesToApply, {})
      unhookWatchdogFunction(watchdog._applyChanges.name)
    })

    it('should start periodic task and subscribe to new blocks', async function () {
      let blockHeader = {}
      hookWatchdogFunction(watchdog._worker.name, function (bh) {
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
      unhookWatchdogFunction(watchdog._worker.name)
    })
    it('should stop periodic task and unsubscribe from new blocks', async function () {
      await watchdog.stop()
    })
  })

  describe('As Admin', async function () {
  })
})

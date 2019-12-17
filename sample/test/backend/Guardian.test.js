/* global describe before after it */

import { assert } from 'chai'
import Web3 from 'web3'
import SMSmock from '../../src/js/mocks/SMS.mock'
import { Watchdog } from '../../src/js/backend/Guardian'
import { KeyManager } from '../../src/js/backend/KeyManager'
import FactoryContractInteractor from 'safechannels-contracts/src/js/FactoryContractInteractor'
import { Account, AccountManager } from '../../src/js/backend/AccountManager'
import { SmsManager } from '../../src/js/backend/SmsManager'
import crypto from 'crypto'
import SimpleWallet from '../../src/js/impl/SimpleWallet'
import Participant from 'safechannels-contracts/src/js/Participant'
import Permissions from 'safechannels-contracts/src/js/Permissions'
// import scutils from 'safechannels-contracts/src/js/SafeChannelUtils'

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
    web3provider = new Web3.providers.HttpProvider(ethNodeUrl)
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
    const config = SimpleWallet.getDefaultSampleInitialConfiguration({
      backendAddress: keypair.address,
      operatorAddress: accountZero,
      whitelistModuleAddress: whitelistPolicy
    })
    config.initialDelays = [0, 0]
    config.requiredApprovalsPerLevel = [0, 0]
    await wallet.initialConfiguration(config)
    await fundAddress(wallet.contract.address)
  })

  describe('As Watchdog', async function () {
    let receipt

    function hookWatchdogApplyChanges () {
      watchdog._applyChangesOrig = watchdog._applyChanges
      watchdog._applyChanges = function () {}
    }

    function unhookWatchdogApplyChanges () {
      watchdog._applyChanges = watchdog._applyChangesOrig
      delete watchdog._applyChangesOrig
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
      assert.isTrue(await wallet.contract.isParticipant(keypair.address,
        watchdog.permsLevel))
      console.log('WD address', watchdog.keyManager.Address())
    })

    it('should NOT apply delayed transfer for unknown accounts', async function () {
      const stateId = await wallet.contract.stateNonce()
      receipt = await wallet.contract.scheduleBypassCall(wallet.participant.permLevel, transferDestination, amount, [],
        stateId,
        { from: accountZero })
      const balanceBefore = await web3.eth.getBalance(transferDestination)
      const bypassCallAppliedEventsBefore = await wallet.contract.getPastEvents('BypassCallApplied')
      await watchdog._worker()
      const balanceAfter = await web3.eth.getBalance(transferDestination)
      const bypassCallAppliedEventsAfter = await wallet.contract.getPastEvents('BypassCallApplied')
      assert.equal(balanceAfter, balanceBefore)
      assert.equal(bypassCallAppliedEventsAfter.length, bypassCallAppliedEventsBefore.length)
    })

    it('should cancel delayed transfer for a known account', async function () {
      const newAccount = new Account({
        accountId: '123456',
        email: '',
        phone: '',
        verified: true,
        address: wallet.contract.address
      })
      watchdog.accountManager.putAccount({ account: newAccount })

      const balanceBefore = await web3.eth.getBalance(transferDestination)
      const bypassCallAppliedEventsBefore = await wallet.contract.getPastEvents('BypassCallCancelled')
      const smsCode = watchdog.smsManager.getSmsCode(
        { phoneNumber: newAccount.phone, email: newAccount.email })

      hookWatchdogApplyChanges()
      await watchdog._worker()
      unhookWatchdogApplyChanges()
      receipt = await watchdog.cancelChange(
        { smsCode, delayedOpId: receipt.logs[0].args.delayedOpId, address: newAccount.address })
      const balanceAfter = await web3.eth.getBalance(transferDestination)
      const bypassCallAppliedEventsAfter = await wallet.contract.getPastEvents('BypassCallCancelled')
      assert.equal(balanceAfter, balanceBefore)
      assert.equal(bypassCallAppliedEventsAfter.length, bypassCallAppliedEventsBefore.length + 1)
    })

    it('should apply delayed transfer for a known account', async function () {
      const stateId = await wallet.contract.stateNonce()
      await wallet.contract.scheduleBypassCall(wallet.participant.permLevel, transferDestination, amount, [], stateId,
        { from: accountZero })
      const balanceBefore = await web3.eth.getBalance(transferDestination)
      const bypassCallAppliedEventsBefore = await wallet.contract.getPastEvents('BypassCallApplied')
      await watchdog._worker()
      const balanceAfter = await web3.eth.getBalance(transferDestination)
      const bypassCallAppliedEventsAfter = await wallet.contract.getPastEvents('BypassCallApplied')
      assert.equal(balanceAfter, amount + parseInt(balanceBefore) + '')
      assert.equal(bypassCallAppliedEventsAfter.length, bypassCallAppliedEventsBefore.length + 1)
      assert.deepEqual(watchdog.changesToApply, {})
    })

    it('should NOT apply bypass call twice', async function () {
      hookWatchdogApplyChanges()
      watchdog.lastScannedBlock = 0
      await watchdog._worker()
      assert.deepEqual(watchdog.changesToApply, {})
      unhookWatchdogApplyChanges()
    })

    it('should NOT apply config change for unknown accounts')

    it('should cancel config change for a known account')

    it.skip('should apply config change for a known account', async function () {
      await wallet.contract.changeConfiguration(wallet.participant.permLevel)
      await watchdog._worker()
    })

    after(async function () {
      // await watchdog.stop()
    })
  })

  describe('As Admin', async function () {
  })
})

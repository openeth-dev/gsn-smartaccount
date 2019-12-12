/* eslint-disable no-unused-expressions */
/* global describe before it */
import assert from 'assert'

import FactoryContractInteractor from 'safechannels-contracts/src/js/FactoryContractInteractor'
import Permissions from 'safechannels-contracts/src/js/Permissions'
import Participant from 'safechannels-contracts/src/js/Participant'

import SimpleWallet from '../../src/js/impl/SimpleWallet'

before(async function () {
// TODO: get accounts
})

function makeConfig (base, smartAccount) {
  let walletConfig = Object.assign({}, base)
  walletConfig.contract = smartAccount
  return walletConfig
}

describe('SimpleWallet', async function () {
  const whitelistPolicy = '0x1111111111111111111111111111111111111111'
  const backend = '0x2222222222222222222222222222222222222222'
  const operator = '0x3333333333333333333333333333333333333333'
  const ethNodeUrl = 'http://localhost:8545'
  const from = '0x90f8bf6a479f320ead074411a4b0e7944ea8c9c1'

  const expectedInitialConfig = require('./testdata/ExpectedInitialConfig')
  const expectedWalletInfoA = require('./testdata/ExpectedWalletInfoA')
  const sampleTransactionHistory = require('./testdata/SampleTransactionHistory')
  const sampleTransactionsPendingList = require('./testdata/SampleTransactionsPendingList')

  const walletSharedConfig = {
    participant:
      new Participant(from, Permissions.OwnerPermissions, 1),
    knownParticipants: [
      new Participant(operator, Permissions.OwnerPermissions, 1),
      new Participant(backend, Permissions.WatchdogPermissions, 1),
      new Participant(backend, Permissions.AdminPermissions, 1)
    ]
  }

  let config
  let wallet
  let smartAccount
  let walletConfig

  before(async function () {
    smartAccount = await FactoryContractInteractor.deploySmartAccountDirectly(from, ethNodeUrl)
    expectedWalletInfoA.address = smartAccount.address
    wallet = new SimpleWallet(makeConfig(walletSharedConfig, smartAccount))
    config = SimpleWallet.getDefaultSampleInitialConfiguration({
      backendAddress: backend,
      operatorAddress: operator,
      whitelistModuleAddress: whitelistPolicy
    })
  })

  describe('#_getDefaultSampleInitialConfiguration()', async function () {
    it('should return valid config given backend and whitelist addresses', async function () {
      assert.deepStrictEqual(config, expectedInitialConfig)
    })
  })

  describe('#initialConfiguration()', async function () {
    it('should accept valid configuration and apply it on-chain', async function () {
      await wallet.initialConfiguration(config)
      const walletInfo = await wallet.getWalletInfo()
      assert.deepStrictEqual(walletInfo, expectedWalletInfoA)
    })

    it('should refuse to work on an already initialized smartAccount')
  })

  describe('#listPendingTransactions()', async function () {
    let stubbedWallet
    before(async function () {
      stubbedWallet = new SimpleWallet(makeConfig(walletSharedConfig, smartAccount))
      stubbedWallet._getPastOperationsEvents = async function () {
        return {
          scheduledEvents: sampleTransactionHistory.filter(it => it.event === 'BypassCallPending'),
          completedEvents: sampleTransactionHistory.filter(it => it.event === 'BypassCallApplied'),
          cancelledEvents: sampleTransactionHistory.filter(it => it.event === 'BypassCallCancelled')
        }
      }
    })

    // TODO: test for
    //  a) bypass config change not appearing here
    //  b) erc20 transactions reported correctly
    //  c) pure eth transfers
    //  d) payable function calls
    // TODO 2: As the code needs to read the 'dueTime' from the contract now, do either:
    //  a) emit it in event
    //  b) do not use static event list for tests as dueTime is always 0
    it('should return a correct list of pending operations', async function () {
      const pending = await stubbedWallet.listPendingTransactions()
      assert.deepEqual(pending, sampleTransactionsPendingList)
    })
  })

  describe('#transfer()', async function () {
    let wallet
    before(async function () {
      const smartAccount = await FactoryContractInteractor.deploySmartAccountDirectly(from, ethNodeUrl)
      wallet = new SimpleWallet(makeConfig(walletSharedConfig, smartAccount))
      const myConfig = SimpleWallet.getDefaultSampleInitialConfiguration({
        backendAddress: backend,
        operatorAddress: from,
        whitelistModuleAddress: whitelistPolicy
      })
      await wallet.initialConfiguration(myConfig)

    })

    it('should initiate delayed ETH transfer', async function () {
      // refresh info to set the stateId. This is used to prevent UI-blockchain race condition (ask Dror)
      await wallet.getWalletInfo()
      const destination = backend
      const amount = 1e5
      await wallet.transfer({ destination, amount, token: 'ETH' })
      const pending = await wallet.listPendingTransactions()
      assert.strictEqual(pending.length, 1)
      assert.strictEqual(pending[0].destination, destination)
      assert.strictEqual(pending[0].value, amount.toString())
      assert.strictEqual(pending[0].tokenSymbol, 'ETH')
    })

    it('should initiate delayed ERC transfer')

    it('should transfer ETH immediately to a whitelisted destination')

    it('should transfer ERC immediately to a whitelisted destination')
  })

  describe('#cancelPending()', async function () {
    it('should cancel the delayed operation')
  })
})

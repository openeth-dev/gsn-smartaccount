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

  let config
  let wallet
  let smartAccount
  let walletConfig

  before(async function () {
    smartAccount = await FactoryContractInteractor.deploySmartAccountDirectly(from, ethNodeUrl)
    expectedWalletInfoA.address = smartAccount.address
    walletConfig = {
      contract: smartAccount,
      participant:
        new Participant(from, Permissions.OwnerPermissions, 1),
      knownParticipants: [
        new Participant(operator, Permissions.OwnerPermissions, 1),
        new Participant(backend, Permissions.WatchdogPermissions, 1),
        new Participant(backend, Permissions.AdminPermissions, 1)
      ]
    }
    wallet = new SimpleWallet(walletConfig)
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
      stubbedWallet = new SimpleWallet(walletConfig)
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

  describe.skip('#transfer()', async function () {
    it('should initiate delayed ETH transfer', async function () {
      const destination = backend
      const amount = 1e5
      await wallet.transfer({ destination, amount })
      const pending = await wallet.listPendingTransactions()
      assert.strictEqual(pending.length, 1)
      assert.strictEqual(pending.destination, destination)
      assert.strictEqual(pending.amount, amount)
      assert.strictEqual(pending.token, 'ETH')
    })

    it('should initiate delayed ERC transfer')

    it('should transfer ETH immediately to a whitelisted destination')

    it('should transfer ERC immediately to a whitelisted destination')
  })

  describe('#cancelPending()', async function () {
    it('should cancel the delayed operation')
  })
})

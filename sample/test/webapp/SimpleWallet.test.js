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

describe.skip('SimpleWallet', async function () {
  const whitelistPolicy = '0x1111111111111111111111111111111111111111'
  const backend = '0x2222222222222222222222222222222222222222'
  const operator = '0x3333333333333333333333333333333333333333'
  const ethNodeUrl = 'http://localhost:8545'
  const from = '0x90f8bf6a479f320ead074411a4b0e7944ea8c9c1'

  const expectedInitialConfig = require('./testdata/ExpectedInitialConfig')
  const expectedWalletInfoA = require('./testdata/ExpectedWalletInfoA')
  const sampleTransactionHistory = require('./testdata/SampleTransactionHistory')

  let config
  let wallet
  let vault
  let walletConfig

  before(async function () {
    vault = await FactoryContractInteractor.deployVaultDirectly(from, ethNodeUrl)
    expectedWalletInfoA.address = vault.address
    walletConfig = {
      contract: vault,
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

    it('should refuse to work on an already initialized vault')
  })

  describe('#listPending()', async function () {
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

    it('should return a correct list of pending operations', async function () {
      const pending = await stubbedWallet.listPending()
      assert.deepStrictEqual(pending, [])
    })
  })

  describe('#transfer()', async function () {
    it('should initiate delayed ETH transfer', async function () {
      const destination = backend
      const amount = 1e5
      await wallet.transfer({ destination, amount })
      const pending = await wallet.listPending()
      assert.strictEqual(pending.length, 1)
      assert.strictEqual(pending.destination, destination)
      assert.strictEqual(pending.amount, amount)
      assert.strictEqual(pending.token, undefined)
    })

    it('should initiate delayed ERC transfer')

    it('should transfer ETH immediately to a whitelisted destination')

    it('should transfer ERC immediately to a whitelisted destination')
  })

  describe('#cancelPending()', async function () {
    it('should cancel the delayed operation')
  })
})

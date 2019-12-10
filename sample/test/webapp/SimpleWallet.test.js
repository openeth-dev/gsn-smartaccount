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
  const whitelist = '0x1111111111111111111111111111111111111111'
  const backend = '0x2222222222222222222222222222222222222222'
  const operator = '0x3333333333333333333333333333333333333333'
  const ethNodeUrl = 'http://localhost:8545'
  const from = '0x90f8bf6a479f320ead074411a4b0e7944ea8c9c1'

  const expectedInitialConfig = {
    _allowAcceleratedCalls: true,
    _allowAddOperatorNow: true,
    bypassMethods: [],
    bypassModules: [
      '0x1111111111111111111111111111111111111111'
    ],
    bypassTargets: [],
    initialDelays: [86400, 172800],
    initialParticipants: [
      '0xf7dc2985b09233348783724655db5042f633426a02a118345a2ee96aab81f5e0',
      '0x8f8b94ea5c9e0a787df6101de79ba882449ea2b9729e989191839ec247ecdb31',
      '0x7cb3e4310827deaab62c9b804e7ab5da8df2dc7be5ad3f8fdb8dde9c93d32498'
    ],
    requiredApprovalsPerLevel: [0, 1]
  }

  const expectedWalletInfoA = {
    options: {
      allowAddOperatorNow: false,
      allowAcceleratedCalls: false
    },
    operators: [operator],
    guardians: [
      { address: backend, level: 1, type: 'watchdog' },
      { address: backend, level: 1, type: 'admin' }
    ],
    unknownGuardians: 0,
    levels: [
      {
        delay: '86400',
        requiredApprovals: 0
      },
      {
        delay: '172800',
        requiredApprovals: 1
      }
    ]
  }

  let config
  let wallet
  let vault

  before(async function () {
    vault = await FactoryContractInteractor.deployVaultDirectly(from, ethNodeUrl)
    expectedWalletInfoA.address = vault.address
    wallet = new SimpleWallet({
      contract: vault,
      participant:
        new Participant(from, Permissions.OwnerPermissions, 1),
      knownParticipants: [
        new Participant(operator, Permissions.OwnerPermissions, 1),
        new Participant(backend, Permissions.WatchdogPermissions, 1),
        new Participant(backend, Permissions.AdminPermissions, 1)
      ]
    })
    config = SimpleWallet.getDefaultSampleInitialConfiguration({
      backendAddress: backend,
      operatorAddress: operator,
      whitelistModuleAddress: whitelist
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
})

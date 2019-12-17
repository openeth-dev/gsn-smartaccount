/* eslint-disable no-unused-expressions */
/* global describe before it */
import assert from 'assert'

import FactoryContractInteractor from 'safechannels-contracts/src/js/FactoryContractInteractor'
import Permissions from 'safechannels-contracts/src/js/Permissions'
import Participant from 'safechannels-contracts/src/js/Participant'

import SimpleWallet from '../../src/js/impl/SimpleWallet'
import ConfigEntry from '../../src/js/etc/ConfigEntry'
import sinon from 'sinon'
import { expect } from 'chai'

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
  const sampleConfigChangeHistoryA = require('./testdata/SampleConfigChangeHistoryA')
  const sampleTransactionsPendingList = require('./testdata/SampleTransactionsPendingList')
  const sampleConfigChangesPendingList = require('./testdata/SampleConfigChangesPendingList')
  const walletSharedConfig = {
    participant:
      new Participant(from, Permissions.OwnerPermissions, 1),
    knownParticipants: [
      new Participant(operator, Permissions.OwnerPermissions, 1),
      new Participant(backend, Permissions.WatchdogPermissions, 1),
      new Participant(backend, Permissions.AdminPermissions, 1)
    ]
  }

  async function newTest (operator = null) {
    const smartAccount = await FactoryContractInteractor.deploySmartAccountDirectly(from, ethNodeUrl)
    const wallet = new SimpleWallet({ ...walletSharedConfig, contract: smartAccount })
    if (operator !== null) {
      const config = SimpleWallet.getDefaultSampleInitialConfiguration({
        backendAddress: backend,
        operatorAddress: operator,
        whitelistModuleAddress: whitelistPolicy
      })
      await wallet.initialConfiguration(config)
    }
    return { smartAccount, wallet }
  }

  describe('#_getDefaultSampleInitialConfiguration()', async function () {
    it('should return valid config given backend and whitelist addresses', async function () {
      const config = SimpleWallet.getDefaultSampleInitialConfiguration({
        backendAddress: backend,
        operatorAddress: operator,
        whitelistModuleAddress: whitelistPolicy
      })
      assert.deepStrictEqual(config, expectedInitialConfig)
    })
  })

  describe('#initialConfiguration()', async function () {
    let testContext
    before(async function () {
      testContext = await newTest()
      expectedWalletInfoA.address = testContext.smartAccount.address
    })

    it('should accept valid configuration and apply it on-chain', async function () {
      const config = SimpleWallet.getDefaultSampleInitialConfiguration({
        backendAddress: backend,
        operatorAddress: operator,
        whitelistModuleAddress: whitelistPolicy
      })
      await testContext.wallet.initialConfiguration(config)
      const walletInfo = await testContext.wallet.getWalletInfo()
      assert.deepStrictEqual(walletInfo, expectedWalletInfoA)
    })

    it('should refuse to work on an already initialized smartAccount')
  })

  describe('#listPendingTransactions()', async function () {
    let testContext
    before(async function () {
      testContext = await newTest()
      testContext.wallet._getRawPastEvents = async function () {
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
      const pending = await testContext.wallet.listPendingTransactions()
      // eslint-disable-next-line node/no-deprecated-api
      assert.deepEqual(pending, sampleTransactionsPendingList)
    })
  })

  // TODO: same as for listPendingTransactions, cover all flows
  describe('#listPendingConfigChanges()', async function () {
    let testContext
    before(async function () {
      testContext = await newTest()
      testContext.wallet._getRawPastEvents = function () {
        return {
          scheduledEvents: sampleConfigChangeHistoryA.filter(it => it.event === 'ConfigPending'),
          completedEvents: sampleConfigChangeHistoryA.filter(it => it.event === 'ConfigCancelled'),
          cancelledEvents: sampleConfigChangeHistoryA.filter(it => it.event === 'ConfigApplied')
        }
      }
    })

    it('should return a correct list of pending config changes', async function () {
      const pending = await testContext.wallet.listPendingConfigChanges()
      // eslint-disable-next-line node/no-deprecated-api
      assert.deepEqual(pending, sampleConfigChangesPendingList)
    })
  })

  describe('#transfer()', async function () {
    let testContext

    before(async function () {
      testContext = await newTest(from)
    })

    it('should initiate delayed ETH transfer', async function () {
      // refresh info to set the stateId. This is used to prevent UI-blockchain race condition (ask Dror)
      await testContext.wallet.getWalletInfo()
      const destination = backend
      const amount = 1e5
      await testContext.wallet.transfer({ destination, amount, token: 'ETH' })
      const pending = await testContext.wallet.listPendingTransactions()
      assert.strictEqual(pending.length, 1)
      assert.strictEqual(pending[0].destination, destination)
      assert.strictEqual(pending[0].value, amount.toString())
      assert.strictEqual(pending[0].tokenSymbol, 'ETH')
    })

    it('should initiate delayed ERC transfer')

    it('should transfer ETH immediately to a whitelisted destination')

    it('should transfer ERC immediately to a whitelisted destination')
  })

  describe('Add Operator Now', async function () {
    // TODO: url parameters TBD
    const url = 'http://server.com/validate?a=123&b=456'
    const description = 'New operator device'
    const newOperator = '0x3333333333333333333333333333333333333333'

    let testContext

    before(async function () {
      testContext = await newTest()
    })

    describe('#validateAddOperatorNow()', async function () {
      it('should pass parameters to backend and handle http 200 OK code', async function () {
        testContext.wallet.backend = {
          validateAddOperatorNow: sinon.spy(
            () => {
              return { code: 200, error: null, newOperator, description }
            })
        }
        const jwt = {}
        const { error, newOperator: newOperatorResp, description: descrResp } = await testContext.wallet.validateAddOperatorNow({
          jwt,
          url
        })
        expect(testContext.wallet.backend.validateAddOperatorNow.calledOnce).to.be.true
        expect(testContext.wallet.backend.validateAddOperatorNow.firstCall.args[0]).to.eql({ jwt, url })
        assert.strictEqual(error, null)
        assert.strictEqual(newOperatorResp, newOperator)
        assert.strictEqual(descrResp, description)
      })
    })

    describe('#addOperatorNow()', async function () {
      let testContext

      before(async function () {
        testContext = await newTest(from)
        await testContext.wallet.getWalletInfo()
      })

      it('should initiate adding new operator', async function () {
        await testContext.wallet.addOperatorNow(newOperator)
        const pending = await testContext.wallet.listPendingConfigChanges()
        assert.strictEqual(pending.length, 1)
        assert.strictEqual(pending[0].operations.length, 1)
        const expectedConfigChange = new ConfigEntry({
          type: 'add_operator_now',
          args: [newOperator]
        })
        assert.deepStrictEqual(pending[0].operations[0], expectedConfigChange)
      })
    })
  })

  describe('#cancelPending()', async function () {
    it('should cancel the delayed operation')
  })
})

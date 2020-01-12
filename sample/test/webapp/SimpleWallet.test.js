/* eslint-disable no-unused-expressions */
/* global describe before after it */
import assert from 'assert'
import Web3 from 'web3'
import FactoryContractInteractor from 'safechannels-contracts/src/js/FactoryContractInteractor'
import Permissions from 'safechannels-contracts/src/js/Permissions'
import Participant from 'safechannels-contracts/src/js/Participant'
import scTestUtils, { getBalance } from 'safechannels-contracts/test/utils'

import BaseBackendMock from '../mocks/BaseBackend.mock'
import SimpleWallet from '../../src/js/impl/SimpleWallet'
import ConfigEntry from '../../src/js/etc/ConfigEntry'
import sinon from 'sinon'
import { testValidationBehavior } from './behavior/SimpleWallet.behavior'
import TestEnvironment from '../utils/TestEnvironment'
import { testGetWalletInfoBehavior } from './behavior/GetWalletInfo.behavior'

before(async function () {
// TODO: get accounts
})
// TODO: the main TODO of this test: instead of json files with test data, create a class that would 'generate'
//  required transaction history; also, stop mocking functions inside class under test - move stub logic to interactor
describe('SimpleWallet', async function () {
  let id
  let web3
  let web3provider
  const backend = '0x2222222222222222222222222222222222222222'
  const operator = '0x3333333333333333333333333333333333333333'
  const ethNodeUrl = 'http://localhost:8545'
  const from = '0x90f8bf6a479f320ead074411a4b0e7944ea8c9c1'

  const expectedInitialConfig = require('./testdata/ExpectedInitialConfig')
  const expectedWalletInfoA = require('./testdata/ExpectedWalletInfoA')
  const expectedTokenBalances = require('./testdata/ExpectedTokenBalances')
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

  before(async function () {
    web3provider = new Web3.providers.HttpProvider(ethNodeUrl)
    web3 = new Web3(web3provider)
    id = (await scTestUtils.snapshot(web3)).result
  })

  after(async function () {
    await scTestUtils.revert(id, web3)
  })

  async function newTest (operator = null, whitelistPreconfigured = [], knownTokens = []) {
    const smartAccount = await FactoryContractInteractor.deploySmartAccountDirectly(from, ethNodeUrl)
    // TODO: duplicate code, testenv does same work as the rest of the code here!!!
    const testEnvironment = await TestEnvironment.initializeWithFakeBackendAndGSN({ clientBackend: BaseBackendMock })
    const whitelistFactory = await testEnvironment.deployWhitelistFactory()
    const wallet = new SimpleWallet(
      {
        ...walletSharedConfig,
        whitelistFactory,
        contract: smartAccount,
        knownTokens
      })
    let whitelistModuleAddress
    if (whitelistPreconfigured.length > 0) {
      const receipt = await wallet.deployWhitelistModule({ whitelistPreconfigured })
      whitelistModuleAddress = receipt.logs[0].args.module
    }
    if (operator !== null) {
      const config = SimpleWallet.getDefaultSampleInitialConfiguration({
        backendAddress: backend,
        operatorAddress: operator,
        whitelistModuleAddress
      })
      await wallet.initialConfiguration(config)
    }
    return { smartAccount, wallet }
  }

  describe('#_getDefaultSampleInitialConfiguration()', async function () {
    it('should return valid config given backend and whitelist addresses', async function () {
      const whitelistModuleAddress = '0x1111111111111111111111111111111111111111'
      const config = SimpleWallet.getDefaultSampleInitialConfiguration({
        backendAddress: backend,
        operatorAddress: operator,
        whitelistModuleAddress
      })
      assert.deepStrictEqual(config, expectedInitialConfig)
    })
  })

  describe('#getWalletInfo', async function () {
    let testContext
    before(async function () {
      testContext = await newTest()
    })
    testGetWalletInfoBehavior(() => testContext)
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
        operatorAddress: operator
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

  describe('#deployWhitelistModule()', async function () {
    let testContext
    before(async function () {
      testContext = await newTest(from)
    })

    it('should deploy a whitelist module with preconfigured list', async function () {
      const whitelistPreconfigured = [backend, operator]
      const receipt = await testContext.wallet.deployWhitelistModule({ whitelistPreconfigured })
      assert.strictEqual(receipt.logs[0].event, 'WhitelistModuleCreated')
    })
  })

  describe('#transfer()', async function () {
    const destination = backend
    const whitelistedDestination = operator
    let testContext
    let dai

    before(async function () {
      dai = await FactoryContractInteractor.deployERC20(from, ethNodeUrl)
      const whitelistPreconfigured = [whitelistedDestination]
      testContext = await newTest(from, whitelistPreconfigured,
        [{ name: 'DAI', address: dai.address }]
      )
      const accountZero = (await web3.eth.getAccounts())[0]
      const accountAddress = testContext.wallet.contract.address
      const tx = {
        from: accountZero,
        value: 1e6,
        to: accountAddress,
        gasPrice: 1
      }
      await web3.eth.sendTransaction(tx)
      await dai.transfer(accountAddress, 1e6.toString(), { from: accountZero })
    })

    const tokens = [{
      name: 'ETH',
      contract: () => null
    },
    {
      name: 'DAI',
      contract: () => dai
    }
    ]
    tokens.forEach(token => {
      it(`should initiate delayed ${token.name} transfer`, async function () {
        // refresh info to set the stateId. This is used to prevent UI-blockchain race condition (ask Dror)
        await testContext.wallet.getWalletInfo()
        const amount = 1e5
        await testContext.wallet.transfer({ destination, amount, token: token.name })
        const pending = await testContext.wallet.listPendingTransactions()
        assert.strictEqual(pending.length, 1)
        assert.strictEqual(pending[0].destination, destination)
        assert.strictEqual(pending[0].value, amount.toString())
        assert.strictEqual(pending[0].tokenSymbol, token.name)
        // local cleanup
        await testContext.wallet.cancelPending(pending[0].delayedOpId)
      })

      it(`should transfer ${token.name} immediately to a whitelisted destination`, async function () {
        await testContext.wallet.getWalletInfo()
        const amount = 1e5

        const srcBalanceBefore = await getBalance(web3, token.contract(), testContext.wallet.contract.address)
        const destBalanceBefore = await getBalance(web3, token.contract(), whitelistedDestination)
        await testContext.wallet.transfer({ destination: whitelistedDestination, amount, token: token.name })
        const srcBalanceAfter = await getBalance(web3, token.contract(), testContext.wallet.contract.address)
        const destBalanceAfter = await getBalance(web3, token.contract(), whitelistedDestination)
        const pending = await testContext.wallet.listPendingTransactions()
        assert.strictEqual(pending.length, 0)
        assert.strictEqual(srcBalanceBefore.toString(), '1000000')
        assert.strictEqual(srcBalanceAfter.toString(), '900000')
        assert.strictEqual(destBalanceBefore.toString(), '0')
        assert.strictEqual(destBalanceAfter.toString(), '100000')
      })
    })
  })

  describe('Add Operator Now', async function () {
    // TODO: url parameters TBD
    const smsCode = '123456'
    const title = 'New operator device'
    const newOperator = '0x3333333333333333333333333333333333333333'

    let testContext

    before(async function () {
      testContext = await newTest()
      testContext.newOperator = newOperator
      testContext.smsCode = smsCode
      testContext.title = title
      testContext.wallet.backend = {
        validateAddOperatorNow: sinon.spy(
          () => {
            return { code: 200, error: null, newOperator, title }
          })
      }
    })

    testValidationBehavior(() => testContext)

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
    const newOperator = '0x3333333333333333333333333333333333333333'

    let testContext
    let pending

    before(async function () {
      testContext = await newTest(from)
    })

    it('should cancel the delayed operation', async function () {
      await testContext.wallet.getWalletInfo()
      await testContext.wallet.transfer({ destination: newOperator, amount: 1e3, token: 'ETH' })
      pending = await testContext.wallet.listPendingTransactions()
      const cancelled = await testContext.wallet.cancelPending(pending[0].delayedOpId)
      assert.strictEqual(cancelled.logs[0].args.delayedOpId, pending[0].delayedOpId)
    })

    it('should cancel the delayed config change', async function () {
      await testContext.wallet.getWalletInfo()
      // TODO: once implemented, use a regular config change here, addOpNow is very edge-case
      await testContext.wallet.addOperatorNow(newOperator)
      pending = await testContext.wallet.listPendingConfigChanges()
      const cancelled = await testContext.wallet.cancelPending(pending[0].delayedOpId)
      assert.strictEqual(cancelled.logs[0].args.delayedOpId, pending[0].delayedOpId)
    })
  })

  describe('#listTokens()', async function () {
    let testContext
    let dai
    let bat
    before(async function () {
      testContext = await newTest(from)
      dai = await FactoryContractInteractor.deployERC20(from, ethNodeUrl)
      bat = await FactoryContractInteractor.deployERC20(from, ethNodeUrl)
      await dai.setSymbol('DAI', { from })
      await bat.setSymbol('BAT', { from })
      await dai.setDecimals(13, { from })
      await bat.setDecimals(11, { from })
      await dai.transfer(testContext.wallet.contract.address, 20000, { from })
      await bat.transfer(testContext.wallet.contract.address, 123456, { from })
      testContext.wallet._addKnownToken(dai.address)
      testContext.wallet._addKnownToken(bat.address)
    })

    it('should return up-to-date balances of all known tokens', async function () {
      const balances = await testContext.wallet.listTokens()
      assert.deepStrictEqual(balances, expectedTokenBalances)
    })
  })

  describe('#applyAllPendingOperations()', async function () {
    let testContext
    before(async function () {
      testContext = await newTest(from)
      await testContext.wallet.getWalletInfo()
      // TODO: migrate to usage of wallet methods after implemented
      await testContext.wallet.contract.changeConfiguration(
        testContext.wallet.participant.permLevel,
        [0], [operator], [operator], testContext.wallet.stateId,
        { from: testContext.wallet.participant.address })
      await testContext.wallet.getWalletInfo()
      await testContext.wallet.transfer({ destination: operator, token: 'ETH', amount: 1e5 })
      const timeGap = 60 * 60 * 24 * 2 + 10
      await scTestUtils.increaseTime(timeGap, testContext.wallet._getWeb3().web3)
    })

    it('should apply all operations that are due', async function () {
      const applied = await testContext.wallet.applyAllPendingOperations()
      // TODO: test more precisely
      assert.strictEqual(applied.length, 2)
      // TODO: check balance changed
      //  check is participant
    })

    it('should not try to apply addOperatorNow')
  })
})

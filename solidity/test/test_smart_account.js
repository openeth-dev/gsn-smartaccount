/* global artifacts web3 contract before it assert describe after */

/* npm modules */
const Chai = require('chai')
const Web3 = require('web3')

/* truffle artifacts */
const WhitelistBypassPolicy = artifacts.require('WhitelistBypassPolicy')
const AllowAllPolicy = artifacts.require('AllowAllPolicy')
const TestContract = artifacts.require('TestContract')
const TestPolicy = artifacts.require('TestPolicy')
const SmartAccount = artifacts.require('SmartAccount')
const Utilities = artifacts.require('Utilities')
const DAI = artifacts.require('DAI')

const testUtils = require('./utils')
const ChangeType = require('./etc/ChangeType')

const Permissions = require('../src/js/Permissions')
const utils = require('../src/js/SafeChannelUtils')
const Participant = require('../src/js/Participant')

const expect = Chai.expect

Chai.use(require('ethereum-waffle').solidity)
Chai.use(require('bn-chai')(web3.utils.toBN))

const minuteInSec = 60
const hourInSec = 60 * minuteInSec
const dayInSec = 24 * hourInSec
const yearInSec = 365 * dayInSec

async function getDelayedOpHashFromEvent (log, utilities) {
  const actions = log.args.actions
  const args1 = log.args.actionsArguments1
  const args2 = log.args.actionsArguments2
  const stateId = log.args.stateId
  const schedulerAddress = log.args.sender
  const schedulerPermsLevel = log.args.senderPermsLevel
  const boosterAddress = log.args.booster
  const boosterPermsLevel = log.args.boosterPermsLevel
  return utilities.transactionHashPublic(actions, args1, args2, stateId, schedulerAddress, schedulerPermsLevel,
    boosterAddress, boosterPermsLevel)
}

async function cancelDelayed ({ res, log }, fromParticipant, smartAccount) {
  const { actions, args1, args2, schedulerAddress, schedulerPermsLevel, boosterAddress, boosterPermsLevel, scheduledStateId } = extractLog(
    log, res)
  return smartAccount.cancelOperation(
    fromParticipant.permLevel,
    actions,
    args1,
    args2,
    scheduledStateId,
    schedulerAddress,
    schedulerPermsLevel,
    boosterAddress,
    boosterPermsLevel,
    { from: fromParticipant.address })
}

function extractLog (log, res) {
  if (log === undefined) {
    log = res.logs[0]
  }
  const actions = log.args.actions
  const args1 = log.args.actionsArguments1
  const args2 = log.args.actionsArguments2
  const schedulerAddress = log.args.sender
  const schedulerPermsLevel = log.args.senderPermsLevel
  const boosterAddress = log.args.booster
  const boosterPermsLevel = log.args.boosterPermsLevel

  const scheduledStateId = log.args.stateId

  const bypassHash = log.args.bypassHash
  const target = log.args.target
  const value = log.args.value
  const msgdata = log.args.msgdata

  return {
    actions,
    args1,
    args2,
    schedulerAddress,
    schedulerPermsLevel,
    boosterAddress,
    boosterPermsLevel,
    bypassHash,
    target,
    value,
    msgdata,
    scheduledStateId
  }
}

async function applyBypass ({ res, log }, fromParticipant, smartAccount) {
  // eslint-disable-next-line no-unused-vars
  const { msgdata, value, target, schedulerAddress, schedulerPermsLevel, boosterAddress, boosterPermsLevel, scheduledStateId } = extractLog(
    log, res)

  return smartAccount.applyBypassCall(
    fromParticipant.permLevel,
    schedulerAddress,
    schedulerPermsLevel,
    scheduledStateId,
    target,
    value,
    msgdata,
    { from: fromParticipant.address })
}

async function applyDelayed ({ res, log }, fromParticipant, smartAccount) {
  const { actions, args1, args2, schedulerAddress, schedulerPermsLevel, boosterAddress, boosterPermsLevel, scheduledStateId } = extractLog(
    log, res)

  return smartAccount.applyConfig(
    fromParticipant.permLevel,
    actions,
    args1,
    args2,
    scheduledStateId,
    schedulerAddress,
    schedulerPermsLevel,
    boosterAddress,
    boosterPermsLevel,
    { from: fromParticipant.address })
}

contract('SmartAccount', async function (accounts) {
  let smartAccount
  let utilities
  let erc20
  const fundedAmount = 300
  const from = accounts[0]
  const level = 1
  const freezerLevel = 2
  const highLevel = 3
  const zeroAddress = '0x0000000000000000000000000000000000000000'
  const destinationAddress = accounts[2]
  const timeGap = 60 * 60 * 24 * 2 + 10
  let initialDelays
  let initialParticipants
  let requiredApprovalsPerLevel
  let operatorA
  let operatorB
  let operatorZ
  let wrongaddr
  let adminA
  let adminB
  let adminB1
  let adminB2
  let adminC
  let adminZ
  let watchdogA
  let watchdogB
  let watchdogZ
  const amount = 100
  let startBlock
  let web3
  let expectedDelayedEventsCount = 0
  let ownerPermissions
  let adminPermissions
  let watchdogPermissions

  before(async function () {
    // Merge events so SmartAccount knows about ERC20’s events
    Object.keys(DAI.events).forEach(function (topic) {
      SmartAccount.network.events[topic] = DAI.events[topic]
    })
    Object.keys(TestContract.events).forEach(function (topic) {
      SmartAccount.network.events[topic] = TestContract.events[topic]
    })

    smartAccount = await SmartAccount.new(zeroAddress, accounts[0], { gas: 8e6 })
    utilities = await Utilities.deployed()
    erc20 = await DAI.new()
    web3 = new Web3(smartAccount.contract.currentProvider)
    ownerPermissions = utils.bufferToHex(await smartAccount.ownerPermissions())
    adminPermissions = utils.bufferToHex(await smartAccount.adminPermissions())
    watchdogPermissions = utils.bufferToHex(await smartAccount.watchdogPermissions())
    console.log(`ownerPermissions: ${ownerPermissions}`)
    console.log(`adminPermissions: ${adminPermissions}`)
    console.log(`watchdogPermissions: ${watchdogPermissions}}`)
    startBlock = await web3.eth.getBlockNumber()
    initParticipants()
  })

  function initParticipants () {
    operatorA = new Participant(accounts[0], ownerPermissions, level, 'operatorA')
    operatorB = new Participant(accounts[11], ownerPermissions, level, 'operatorB')
    operatorZ = new Participant(accounts[14], ownerPermissions, 5, 'operatorZ')
    wrongaddr = new Participant(accounts[1], ownerPermissions, level, 'wrongAddress')
    adminA = new Participant(accounts[3], adminPermissions, level, 'adminA')
    adminB = new Participant(accounts[4], adminPermissions, level, 'adminB')
    adminB1 = new Participant(accounts[5], adminPermissions, highLevel, 'adminB1')
    adminB2 = new Participant(accounts[13], adminPermissions, freezerLevel, 'adminB2')
    adminC = new Participant(accounts[6], adminPermissions, level, 'adminC')
    adminZ = new Participant(accounts[13], adminPermissions, 5, 'adminZ')
    watchdogA = new Participant(accounts[7], watchdogPermissions, level, 'watchdogA')
    watchdogB = new Participant(accounts[8], watchdogPermissions, freezerLevel, 'watchdogB')
    watchdogZ = new Participant(accounts[12], watchdogPermissions, 5, 'watchdogZ')
  }

  async function getLastEvent (contract, event, expectedCount) {
    const delayedEvents = await contract.getPastEvents(event, {
      fromBlock: startBlock,
      toBlock: 'latest'
    })
    // If 'contract' changes, just make sure to take the right one
    assert.equal(delayedEvents.length, expectedCount)
    return delayedEvents[delayedEvents.length - 1].returnValues
  }

  it('should not receive the initial configuration with too many participants', async function () {
    const wrongInitialDelays = []
    const initialParticipants = Array(21).fill('0x1123123')
    await expect(
      smartAccount.initialConfig(initialParticipants, wrongInitialDelays, true, true, [0, 0, 0], [], [], [])
    ).to.be.revertedWith('too many participants')
  })

  it('should not receive the initial configuration with too many levels', async function () {
    const wrongInitialDelays = Array(11).fill(10)
    const initialParticipants = []
    await expect(
      smartAccount.initialConfig(initialParticipants, wrongInitialDelays, true, true, [0, 0, 0], [], [], [])
    ).to.be.revertedWith('too many levels')
    await expect(
      smartAccount.initialConfig(initialParticipants, [], true, true, Array(11).fill(0), [], [], [])
    ).to.be.revertedWith('too many levels again')
  })

  it('should not receive the initial configuration with delay too long', async function () {
    const wrongInitialDelays = Array.from({ length: 10 }, (x, i) => (i + 1) * yearInSec)
    const initialParticipants = []
    await expect(
      smartAccount.initialConfig(initialParticipants, wrongInitialDelays, true, true, [0, 0, 0], [], [], [])
    ).to.be.revertedWith('Delay too long')
  })

  /* Initial configuration */
  it('should receive the initial smartAccount configuration', async function () {
    initialDelays = Array.from({ length: 10 }, (x, i) => (i + 1) * dayInSec)
    requiredApprovalsPerLevel = [0, 0, 1, 2, 3, 4, 5, 6, 7, 8]
    initialParticipants = [
      utils.bufferToHex(utils.participantHash(operatorA.address, operatorA.permLevel)),
      utils.bufferToHex(utils.participantHash(adminA.address, adminA.permLevel)),
      utils.bufferToHex(utils.participantHash(adminB.address, adminB.permLevel)),
      utils.bufferToHex(utils.participantHash(watchdogA.address, watchdogA.permLevel)),
      utils.bufferToHex(utils.participantHash(watchdogZ.address, watchdogZ.permLevel)),
      utils.bufferToHex(utils.participantHash(adminZ.address, adminZ.permLevel)),
      utils.bufferToHex(utils.participantHash(adminB2.address, adminB2.permLevel))
    ]

    const res = await smartAccount.initialConfig(initialParticipants, initialDelays, true, true,
      requiredApprovalsPerLevel, [], [], [], { from: operatorA.address })
    const log = res.logs[0]
    assert.equal(log.event, 'SmartAccountInitialized')

    // let participants = [operatorA, adminA, adminB, watchdogA, watchdogB, operatorB, adminC, wrongaddr];
    const participants = [
      operatorA.expect(),
      adminA.expect(),
      adminB.expect(),
      watchdogA.expect(),
      adminB2.expect(),
      watchdogB,
      operatorB,
      adminC,
      wrongaddr]
    await utils.validateConfigParticipants(participants, smartAccount)
    await utils.validateConfigDelays(initialDelays, smartAccount)
    await utils.validateConfigApprovalsPerLevel(requiredApprovalsPerLevel, smartAccount)
  })

  it('should not receive the initial configuration after configured once', async function () {
    const initialDelays = []
    const initialParticipants = []
    await expect(
      smartAccount.initialConfig(initialParticipants, initialDelays, true, true, requiredApprovalsPerLevel, [], [], [],
        { from: operatorA.address })
    ).to.be.revertedWith('already initialized')
  })
  /* Positive flows */

  describe('testing accelerated calls flag', function () {
    // it("should revert when trying to cancel a transfer transaction that does not exist", async function () {
    //     await expect(
    //         smartAccount.cancelBypassCall(watchdogA.permLevel, operatorA.address, operatorA.permLevel, 0, zeroAddress, 0, [], {from: watchdogA.address})
    //     ).to.be.revertedWith("cancel called for non existent pending bypass call");
    // });
    //
    // it("should allow the owner to create a delayed ether transfer transaction", async function () {
    //     let stateId = await smartAccount.stateNonce();
    //     let res = await smartAccount.scheduleBypassCall(operatorA.permLevel, destinationAddress, amount, []);
    //     expectedDelayedEventsCount++;
    //     let log = res.logs[0];
    //     assert.equal(log.event, "BypassCallPending");
    //     assert.equal(log.address, smartAccount.address);
    //     assert.equal(log.args.target, destinationAddress);
    //     assert.equal(log.args.value, amount);
    //     let hash = "0x" + utils.bypassCallHash(stateId, operatorA.address, operatorA.permLevel, destinationAddress, amount, "").toString("hex");
    //     let pendingCall = await smartAccount.pendingBypassCalls(hash);
    //     assert.isAbove(pendingCall.toNumber(), 0)
    // });
    //
    // it("just funding the smartAccount", async function () {
    //     await web3.eth.sendTransaction({from: operatorA.address, to: smartAccount.address, value: amount * 10});
    // });
    //
    // it("should allow the owner to execute a delayed transfer transaction after delay", async function () {
    //
    //     let addedLog = await getLastEvent(smartAccount.contract, "BypassCallPending", expectedDelayedEventsCount);
    //     let balanceSenderBefore = parseInt(await web3.eth.getBalance(smartAccount.address));
    //     let balanceReceiverBefore = parseInt(await web3.eth.getBalance(destinationAddress));
    //     assert.isAbove(balanceSenderBefore, amount);
    //     await testUtils.increaseTime(timeGap, web3);
    //     let res = await smartAccount.applyBypassCall(operatorA.permLevel, operatorA.address, operatorA.permLevel, addedLog.stateNonce, addedLog.target, addedLog.value, [], {from: operatorA.address});
    //     let log = res.logs[0];
    //
    //     assert.equal(log.event, "BypassCallApplied");
    //     let hash = "0x" + utils.bypassCallHash(addedLog.stateNonce, operatorA.address, operatorA.permLevel, addedLog.target, addedLog.value, "").toString("hex");
    //     assert.equal(log.args.bypassHash, hash);
    //     assert.equal(log.args.status, true);
    //
    //     let balanceSenderAfter = parseInt(await web3.eth.getBalance(smartAccount.address));
    //     let balanceReceiverAfter = parseInt(await web3.eth.getBalance(destinationAddress));
    //     assert.equal(balanceSenderAfter, balanceSenderBefore - amount);
    //     assert.equal(balanceReceiverAfter, balanceReceiverBefore + amount);
    // });
    //
    // it(`should allow the cancellers to cancel a delayed transfer transaction`, async function () {
    //     await utils.asyncForEach(
    //         [operatorA, watchdogA],
    //         async (participant) => {
    //             let res1 = await smartAccount.scheduleBypassCall(operatorA.permLevel, destinationAddress, amount, []);
    //             expectedDelayedEventsCount++;
    //             let log1 = res1.logs[0];
    //
    //             let res2 = await smartAccount.cancelBypassCall(
    //                 participant.permLevel,
    //                 log1.args.sender,
    //                 log1.args.senderPermsLevel,
    //                 log1.args.stateNonce,
    //                 log1.args.target,
    //                 log1.args.value,
    //                 [],
    //                 {from: participant.address});
    //             let log2 = res2.logs[0];
    //             assert.equal(log2.event, "BypassCallCancelled");
    //             assert.equal(log2.address, log1.address);
    //         });
    // });

    it('should disable accelerated calls', async function () {
      await expect(
        smartAccount.executeBypassCall(operatorA.permLevel, destinationAddress, amount, [])
      ).to.be.revertedWith('Call cannot be executed immediately')
      assert.equal(true, await smartAccount.allowAcceleratedCalls())
      const stateId = await smartAccount.stateNonce()
      const actions = [ChangeType.SET_ACCELERATED_CALLS]
      // bool to bytes32 basically...
      const args = [Buffer.from('0'.repeat(64), 'hex')]
      const res = await smartAccount.changeConfiguration(operatorA.permLevel, actions, args, args, stateId,
        { from: operatorA.address })
      assert.equal(res.logs[0].event, 'ConfigPending')
      await expect(
        applyDelayed({ res }, operatorA, smartAccount)
      ).to.be.revertedWith('apply called before due time')
      await testUtils.increaseTime(timeGap, web3)
      applyDelayed({ res }, operatorA, smartAccount)
      assert.equal(false, await smartAccount.allowAcceleratedCalls())
    })

    it('should revert accelerated calls when disabled', async function () {
      await expect(
        smartAccount.executeBypassCall(operatorA.permLevel, destinationAddress, amount, [])
      ).to.be.revertedWith('Accelerated calls blocked')
    })

    it('should re-enable accelerated calls', async function () {
      assert.equal(false, await smartAccount.allowAcceleratedCalls())
      const stateId = await smartAccount.stateNonce()
      const actions = [ChangeType.SET_ACCELERATED_CALLS]
      // bool to bytes32 basically...
      const args = [Buffer.from('1'.repeat(64), 'hex')]
      const res = await smartAccount.changeConfiguration(operatorA.permLevel, actions, args, args, stateId,
        { from: operatorA.address })
      assert.equal(res.logs[0].event, 'ConfigPending')
      await expect(
        applyDelayed({ res }, operatorA, smartAccount)
      ).to.be.revertedWith('apply called before due time')
      await testUtils.increaseTime(timeGap, web3)
      applyDelayed({ res }, operatorA, smartAccount)
      assert.equal(true, await smartAccount.allowAcceleratedCalls())
      await expect(
        smartAccount.executeBypassCall(operatorA.permLevel, destinationAddress, amount, [])
      ).to.be.revertedWith('Call cannot be executed immediately')
    })
  })

  /* Plain send */
  it('should allow the owner to create a delayed ether transfer transaction', async function () {
    const stateId = await smartAccount.stateNonce()
    const res = await smartAccount.scheduleBypassCall(operatorA.permLevel, destinationAddress, amount, [], stateId)
    expectedDelayedEventsCount++
    const log = res.logs[0]
    assert.equal(log.event, 'BypassCallPending')
    assert.equal(log.address, smartAccount.address)
    assert.equal(log.args.target, destinationAddress)
    assert.equal(log.args.value, amount)
    const hash = '0x' + utils.bypassCallHash(stateId, operatorA.address, operatorA.permLevel, destinationAddress,
      amount, '').toString('hex')
    const pendingCall = await smartAccount.pendingBypassCalls(hash)
    assert.isAbove(pendingCall.toNumber(), 0)
  })

  it('just funding the smartAccount', async function () {
    await web3.eth.sendTransaction({ from: operatorA.address, to: smartAccount.address, value: amount * 10 })
  })

  it('should allow the owner to execute a delayed transfer transaction after delay', async function () {
    const addedLog = await getLastEvent(smartAccount.contract, 'BypassCallPending', expectedDelayedEventsCount)
    const balanceSenderBefore = parseInt(await web3.eth.getBalance(smartAccount.address))
    const balanceReceiverBefore = parseInt(await web3.eth.getBalance(destinationAddress))
    assert.isAbove(balanceSenderBefore, amount)
    await testUtils.increaseTime(timeGap, web3)
    const res = await smartAccount.applyBypassCall(operatorA.permLevel, operatorA.address, operatorA.permLevel,
      addedLog.stateId, addedLog.target, addedLog.value, [], { from: operatorA.address })
    const log = res.logs[0]

    assert.equal(log.event, 'BypassCallApplied')
    const hash = '0x' + utils.bypassCallHash(addedLog.stateId, operatorA.address, operatorA.permLevel, addedLog.target,
      addedLog.value, '').toString('hex')
    assert.equal(log.args.delayedOpId, hash)
    assert.equal(log.args.status, true)

    const balanceSenderAfter = parseInt(await web3.eth.getBalance(smartAccount.address))
    const balanceReceiverAfter = parseInt(await web3.eth.getBalance(destinationAddress))
    assert.equal(balanceSenderAfter, balanceSenderBefore - amount)
    assert.equal(balanceReceiverAfter, balanceReceiverBefore + amount)
  })

  it('funding the smartAccount with ERC20 tokens', async function () {
    await testUtils.fundSmartAccountWithERC20(smartAccount.address, erc20, fundedAmount, from)
  })

  it('should allow the owner to create a delayed erc20 transfer transaction', async function () {
    const calldata = erc20.contract.methods.transfer(destinationAddress, amount).encodeABI()
    const stateId = await smartAccount.stateNonce()
    const res = await smartAccount.scheduleBypassCall(operatorA.permLevel, erc20.address, 0, calldata, stateId)
    expectedDelayedEventsCount++
    const log = res.logs[0]
    assert.equal(log.event, 'BypassCallPending')
    assert.equal(log.address, smartAccount.address)
    assert.equal(log.args.value, 0)
    assert.equal(log.args.target, erc20.address)

    const hash = '0x' + utils.bypassCallHash(log.args.stateId, log.args.sender, log.args.senderPermsLevel,
      log.args.target, log.args.value, log.args.msgdata).toString('hex')
    const pendingCall = await smartAccount.pendingBypassCalls(hash)
    assert.isAbove(pendingCall.toNumber(), 0)
  })

  it('should allow the owner to execute a delayed erc20 transfer transaction after delay', async function () {
    const addedLog = await getLastEvent(smartAccount.contract, 'BypassCallPending', expectedDelayedEventsCount)
    const balanceSenderBefore = (await erc20.balanceOf(smartAccount.address)).toNumber()
    const balanceReceiverBefore = (await erc20.balanceOf(destinationAddress)).toNumber()
    assert.isAbove(balanceSenderBefore, amount)
    await testUtils.increaseTime(timeGap, web3)

    const res = await smartAccount.applyBypassCall(operatorA.permLevel, addedLog.sender, addedLog.senderPermsLevel,
      addedLog.stateId, addedLog.target, addedLog.value, addedLog.msgdata, { from: operatorA.address })

    let log = res.logs[0]
    assert.equal(log.event, 'Transfer')
    assert.equal(log.args.value, amount)
    assert.equal(log.args.from, smartAccount.address)
    assert.equal(log.args.to, destinationAddress)

    log = res.logs[1]
    // TODO: TBD: should this event have other fields, or is it more reliable to lookup the 'scheduled' event?
    assert.equal(log.event, 'BypassCallApplied')
    assert.equal(log.args.status, true)

    const balanceSenderAfter = (await erc20.balanceOf(smartAccount.address)).toNumber()
    const balanceReceiverAfter = (await erc20.balanceOf(destinationAddress)).toNumber()
    assert.equal(balanceSenderAfter, balanceSenderBefore - amount)
    assert.equal(balanceReceiverAfter, balanceReceiverBefore + amount)
  })

  it('should revert an attempt to re-apply a bypass call ', async function () {
    const addedLog = await getLastEvent(smartAccount.contract, 'BypassCallPending', expectedDelayedEventsCount)
    const balanceSenderBefore = (await erc20.balanceOf(smartAccount.address)).toNumber()
    assert.isAbove(balanceSenderBefore, amount)
    await testUtils.increaseTime(timeGap, web3)

    await expect(
      smartAccount.applyBypassCall(operatorA.permLevel, addedLog.sender, addedLog.senderPermsLevel, addedLog.stateId,
        addedLog.target, addedLog.value, addedLog.msgdata, { from: operatorA.address })
    ).to.be.revertedWith('apply called for non existent pending bypass call')
  })

  describe('custom delay tests', async function () {
    const maxDelay = 365 * yearInSec
    // TODO: new negative flow tests for 'schedule' flow
    it.skip('should revert delayed ETH transfer due to invalid delay', async function () {
      const stateId = await smartAccount.stateNonce()
      await expect(
        smartAccount.sendEther(operatorA.permLevel, destinationAddress, amount, initialDelays[0], stateId)
      ).to.be.revertedWith('Invalid delay given')
      await expect(
        smartAccount.sendEther(operatorA.permLevel, destinationAddress, amount, maxDelay + 1, stateId)
      ).to.be.revertedWith('Invalid delay given')
    })
  })

  /**
   * If running this 'describe' only, do not forget to initialize and fund the smartAccount
   */
  describe('Bypass Modules', async function () {
    let module
    let allowAll
    let testPolicy
    let testContract
    let differentErc20
    let targetThatCanDoAll
    let whitelistedDestination

    before(async function () {
      whitelistedDestination = adminB2.address
      module = await WhitelistBypassPolicy.new(smartAccount.address, [whitelistedDestination])
      allowAll = await AllowAllPolicy.new()
      testPolicy = await TestPolicy.new()
      testContract = await TestContract.new()
      differentErc20 = await DAI.new()
      targetThatCanDoAll = erc20.address
      await differentErc20.transfer(smartAccount.address, 1000000)
    })

    it('should add a bypass module by target after delay', async function () {
      const actions = [ChangeType.ADD_BYPASS_BY_TARGET, ChangeType.ADD_BYPASS_BY_TARGET]
      const stateId = await smartAccount.stateNonce()
      const res = await smartAccount.changeConfiguration(
        operatorA.permLevel, actions, [targetThatCanDoAll, testContract.address],
        [allowAll.address, testPolicy.address], stateId)
      await testUtils.increaseTime(timeGap, web3)
      const res2 = await applyDelayed({ res }, operatorA, smartAccount)
      const bypassForTarget = await smartAccount.bypassPoliciesByTarget(erc20.address)
      assert.equal(res2.logs[0].event, 'BypassByTargetAdded')
      assert.equal(res2.logs[0].args.target, erc20.address)
      assert.equal(res2.logs[0].args.bypass, allowAll.address)
      assert.equal(bypassForTarget, allowAll.address)
    })

    it('should add a bypass module by method after delay', async function () {
      const actions = [ChangeType.ADD_BYPASS_BY_METHOD]
      const stateId = await smartAccount.stateNonce()
      const method = erc20.contract.methods.approve(operatorA.address, 0).encodeABI().substr(0, 10)
      const methods = [method]
      const res = await smartAccount.changeConfiguration(
        operatorA.permLevel, actions, methods, [module.address], stateId)
      await testUtils.increaseTime(timeGap, web3)
      const res2 = await applyDelayed({ res }, operatorA, smartAccount)
      const bypassForMethod = await smartAccount.bypassPoliciesByMethod(method)
      assert.equal(res2.logs[0].event, 'BypassByMethodAdded')
      assert.equal(res2.logs[0].args.method, method)
      assert.equal(res2.logs[0].args.bypass, module.address)
      assert.equal(bypassForMethod, module.address)
    })

    it('should use default level settings if no module configured', async function () {
      const calldata = erc20.contract.methods.transfer(whitelistedDestination, 1000000).encodeABI()
      await expect(
        smartAccount.executeBypassCall(operatorA.permLevel, differentErc20.address, 0, calldata)
      ).to.be.revertedWith('Call cannot be executed immediately')
      const stateId = await smartAccount.stateNonce()
      const res = await smartAccount.scheduleBypassCall(operatorA.permLevel, differentErc20.address, 0, calldata,
        stateId)
      await testUtils.increaseTime(timeGap, web3)
      const res2 = await applyBypass({ res }, operatorA, smartAccount)
      assert.equal(res2.logs[0].event, 'Transfer')
      assert.equal(res2.logs[1].event, 'BypassCallApplied')
    })

    it('should bypass a call by target first', async function () {
      const calldata = erc20.contract.methods.increaseAllowance(whitelistedDestination, 1000000).encodeABI()
      const res = await smartAccount.executeBypassCall(operatorA.permLevel, targetThatCanDoAll, 0, calldata)
      assert.equal(res.logs[0].event, 'Approval')
    })

    it('should bypass a call by method if no module-by-target is set', async function () {
      const calldata = erc20.contract.methods.approve(whitelistedDestination, 1000000).encodeABI()
      const res = await smartAccount.executeBypassCall(operatorA.permLevel, differentErc20.address, 0, calldata)
      assert.equal(res.logs[0].event, 'Approval')
    })

    it('should apply call once approval is given if the policy allows this', async function () {
      const stateId = await smartAccount.stateNonce()
      await smartAccount.scheduleBypassCall(operatorA.permLevel, testContract.address, 7, [], stateId)
      await expect(
        smartAccount.applyBypassCall(operatorA.permLevel, operatorA.address, operatorA.permLevel, stateId,
          testContract.address, 7, [])
      ).to.be.revertedWith('Pending approvals')

      await expect(
        smartAccount.approveBypassCall(
          adminA.permLevel, operatorA.address, operatorA.permLevel, stateId, testContract.address, 7, [],
          {
            from: adminA.address
          }
        )
      ).to.be.revertedWith(`permissions missing: ${Permissions.CanApprove}`)
      await smartAccount.approveBypassCall(
        watchdogA.permLevel, operatorA.address, operatorA.permLevel, stateId, testContract.address, 7, [],
        {
          from: watchdogA.address
        }
      )
      const res = await smartAccount.applyBypassCall(operatorA.permLevel, operatorA.address, operatorA.permLevel,
        stateId, testContract.address, 7, [])
      assert.equal(res.logs[0].event, 'DoNotWaitForDelay')
    })

    it('should apply call only after delay even if approval is given', async function () {
      const stateId = await smartAccount.stateNonce()
      await smartAccount.scheduleBypassCall(operatorA.permLevel, testContract.address, 6, [], stateId)
      await expect(
        smartAccount.approveBypassCall(
          adminA.permLevel, operatorA.address, operatorA.permLevel, stateId, testContract.address, 6, [],
          {
            from: adminA.address
          }
        )
      ).to.be.revertedWith(`permissions missing: ${Permissions.CanApprove}`)
      await smartAccount.approveBypassCall(
        watchdogA.permLevel, operatorA.address, operatorA.permLevel, stateId, testContract.address, 6, [],
        {
          from: watchdogA.address
        }
      )
      await expect(
        smartAccount.applyBypassCall(operatorA.permLevel, operatorA.address, operatorA.permLevel, stateId,
          testContract.address, 6, [])
      ).to.be.revertedWith('apply called before due time')
      await testUtils.increaseTime(timeGap, web3)
      const res = await smartAccount.applyBypassCall(operatorA.permLevel, operatorA.address, operatorA.permLevel,
        stateId, testContract.address, 6, [])
      assert.equal(res.logs[0].event, 'WaitForDelay')
    })
  })

  /* Canceled send, rejected send */

  it('should revert when trying to cancel a transfer transaction that does not exist', async function () {
    await expect(
      smartAccount.cancelBypassCall(watchdogA.permLevel, operatorA.address, operatorA.permLevel, 0, zeroAddress, 0, [],
        { from: watchdogA.address })
    ).to.be.revertedWith('cancel called for non existent pending bypass call')
  })

  it('should allow the owner to create a delayed config transaction', async function () {
    const actions = [ChangeType.ADD_PARTICIPANT]
    const args = [utils.participantHash(adminB1.address, adminB1.permLevel)]
    const stateId = await smartAccount.stateNonce()
    const res = await smartAccount.changeConfiguration(operatorA.permLevel, actions, args, args, stateId)
    const log = res.logs[0]
    assert.equal(log.event, 'ConfigPending')
    assert.equal(log.args.sender, operatorA.address)
    assert.equal('0x' + log.args.senderPermsLevel.toString('hex'), operatorA.permLevel)
    assert.deepEqual(log.args.actions.map(it => {
      return it.toNumber()
    }), actions)
    assert.deepEqual(log.args.actionsArguments1, args.map(it => {
      return utils.bufferToHex(it)
    }))
  })

  it('should store admins\' credentials hashed', async function () {
    const hash = utils.bufferToHex(utils.participantHash(adminA.address, adminA.permLevel))
    const isAdmin = await smartAccount.participants(hash)
    assert.equal(true, isAdmin)
  })

  /* Rejected config change */
  it('should allow the watchdog to cancel a delayed config transaction', async function () {
    const log = await testUtils.extractLastConfigPendingEvent(smartAccount)
    const hash = await getDelayedOpHashFromEvent(log, utilities)
    const res2 = await cancelDelayed({ log }, watchdogA, smartAccount)
    const log2 = res2.logs[0]
    assert.equal(log2.event, 'ConfigCancelled')
    assert.equal(log2.args.delayedOpId, hash)
    assert.equal(log2.args.sender, watchdogA.address)

    await utils.validateConfigParticipants(
      [adminA.expect(), adminB.expect(), adminB1],
      smartAccount)
  })

  it('should not allow the watchdog to cancel operations scheduled by a higher level participants')

  it('should revert an attempt to delete admin that is not a part of the config', async function () {
    const actions = [ChangeType.REMOVE_PARTICIPANT]
    const args = [utils.participantHash(adminC.address, adminC.permLevel)]
    const stateId = await smartAccount.stateNonce()
    const res = await smartAccount.changeConfiguration(operatorA.permLevel, actions, args, args, stateId)
    const log = res.logs[0]
    assert.equal(log.event, 'ConfigPending')
    await testUtils.increaseTime(timeGap, web3)
    await expect(
      applyDelayed({ res }, operatorA, smartAccount)
    ).to.be.revertedWith('there is no such participant')
  })

  it('should allow the owner to add an admin after a delay', async function () {
    const actions = [ChangeType.ADD_PARTICIPANT]
    const args = [utils.participantHash(adminC.address, adminC.permLevel)]
    const stateId = await smartAccount.stateNonce()
    const res = await smartAccount.changeConfiguration(operatorA.permLevel, actions, args, args, stateId)

    await expect(
      applyDelayed({ res }, operatorA, smartAccount)
    ).to.be.revertedWith('called before due time')
    await testUtils.increaseTime(timeGap, web3)
    const res2 = await applyDelayed({ res }, operatorA, smartAccount)
    const log2 = res2.logs[0]
    const hash = utils.bufferToHex(utils.participantHash(adminC.address, adminC.permLevel))
    assert.equal(log2.event, 'ParticipantAdded')
    assert.equal(log2.args.participant, hash)
    await utils.validateConfigParticipants(
      [adminA.expect(), adminB.expect(), adminB1, adminC.expect()],
      smartAccount)
  })

  it('should allow the owner to delete an admin after a delay', async function () {
    const actions = [ChangeType.REMOVE_PARTICIPANT]
    const args = [utils.participantHash(adminC.address, adminC.permLevel)]
    const stateId = await smartAccount.stateNonce()
    const res = await smartAccount.changeConfiguration(operatorA.permLevel, actions, args, args, stateId)
    const log = res.logs[0]
    assert.equal(log.event, 'ConfigPending')
    await testUtils.increaseTime(timeGap, web3)
    const res2 = await applyDelayed({ res }, operatorA, smartAccount)
    assert.equal(res2.logs[0].event, 'ParticipantRemoved')
    await utils.validateConfigParticipants(
      [adminA.expect(), adminB.expect(), adminB1, adminC],
      smartAccount)
  })

  /* Admin replaced */
  it('should allow the owner to replace an admin after a delay', async function () {
    const stateId = await smartAccount.stateNonce()
    const changeType1 = ChangeType.ADD_PARTICIPANT
    const changeArg1 = utils.participantHash(adminB1.address, adminB1.permLevel)
    const changeType2 = ChangeType.REMOVE_PARTICIPANT
    const changeArg2 = utils.participantHash(adminB.address, adminB.permLevel)
    await smartAccount.changeConfiguration(operatorA.permLevel, [changeType1, changeType2], [changeArg1, changeArg2],
      [changeArg1, changeArg2], stateId)

    await expect(
      smartAccount.applyConfig(operatorA.permLevel, [changeType1, changeType2], [changeArg1, changeArg2],
        [changeArg1, changeArg2], stateId, operatorA.address, operatorA.permLevel, zeroAddress, 0)
    ).to.be.revertedWith('called before due time')

    await testUtils.increaseTime(timeGap, web3)

    const res = await smartAccount.applyConfig(operatorA.permLevel, [changeType1, changeType2],
      [changeArg1, changeArg2], [changeArg1, changeArg2], stateId, operatorA.address, operatorA.permLevel, zeroAddress,
      0)

    assert.equal(res.logs[0].event, 'ParticipantAdded')
    assert.equal(res.logs[1].event, 'ParticipantRemoved')

    await utils.validateConfigParticipants(
      [adminA.expect(), adminB, adminB1.expect(), adminC],
      smartAccount)
  })

  it('should revert an attempt to re-apply a config change', async function () {
    const stateId = await smartAccount.stateNonce()
    const changeType1 = ChangeType.ADD_PARTICIPANT
    const changeArg1 = utils.participantHash(adminB1.address, adminB1.permLevel)
    await smartAccount.changeConfiguration(operatorA.permLevel, [changeType1], [changeArg1], [changeArg1], stateId)

    await expect(
      smartAccount.applyConfig(operatorA.permLevel, [changeType1], [changeArg1], [changeArg1], stateId,
        operatorA.address, operatorA.permLevel, zeroAddress, 0)
    ).to.be.revertedWith('called before due time')

    await testUtils.increaseTime(timeGap, web3)

    const res = await smartAccount.applyConfig(operatorA.permLevel, [changeType1], [changeArg1], [changeArg1], stateId,
      operatorA.address, operatorA.permLevel, zeroAddress, 0)

    assert.equal(res.logs[0].event, 'ParticipantAdded')

    await utils.validateConfigParticipants(
      [adminA.expect(), adminB1.expect(), adminC],
      smartAccount)

    await expect(
      smartAccount.applyConfig(operatorA.permLevel, [changeType1], [changeArg1], [changeArg1], stateId,
        operatorA.address, operatorA.permLevel, zeroAddress, 0)
    ).to.be.revertedWith('apply called for non existent pending change')
  })

  /* Owner loses phone */
  it('should allow an admin to add an operator after a delay', async function () {
    let participants = [operatorA.expect(), operatorB]
    await utils.validateConfigParticipants(participants, smartAccount)
    const stateId = await smartAccount.stateNonce()
    assert.equal(true, await smartAccount.isParticipant(adminA.address, adminA.permLevel))
    assert.equal(false, await smartAccount.isParticipant(operatorB.address, operatorB.permLevel))
    const res = await smartAccount.scheduleAddOperator(adminA.permLevel, operatorB.address, stateId,
      { from: adminA.address })
    await expect(
      applyDelayed({ res }, adminA, smartAccount)
    ).to.be.revertedWith('apply called before due time')
    await testUtils.increaseTime(timeGap, web3)
    await applyDelayed({ res }, adminA, smartAccount)
    participants = [operatorA.expect(), operatorB.expect()]
    assert.equal(true, await smartAccount.isParticipant(operatorB.address, operatorB.permLevel))
    await utils.validateConfigParticipants(participants, smartAccount)
  })

  /* There is no scenario where this is described, but this is how it was implemented and now it is documented */
  it('should allow an owner to remove an owner after a delay', async function () {
    let participants = [operatorA.expect(), operatorB.expect()]
    await utils.validateConfigParticipants(participants, smartAccount)
    const stateId = await smartAccount.stateNonce()
    const actions = [ChangeType.REMOVE_PARTICIPANT]
    const args = [utils.participantHash(operatorB.address, operatorB.permLevel)]
    const res = await smartAccount.changeConfiguration(operatorA.permLevel, actions, args, args, stateId,
      { from: operatorA.address })
    await testUtils.increaseTime(timeGap, web3)
    await applyDelayed({ res }, operatorB, smartAccount)
    participants = [operatorA.expect(), operatorB]
    await utils.validateConfigParticipants(participants, smartAccount)
  })

  describe('testing immediate operator addition', function () {
    let res

    it('should revert an attempt to add operator immediately by normal applyConfig()', async function () {
      const participants = [operatorA.expect(), operatorB]
      await utils.validateConfigParticipants(participants, smartAccount)
      assert.equal(true, await smartAccount.isParticipant(adminA.address, adminA.permLevel))
      assert.equal(false, await smartAccount.isParticipant(operatorB.address, operatorB.permLevel))
      const stateId = await smartAccount.stateNonce()
      res = await smartAccount.addOperatorNow(operatorA.permLevel, operatorB.address, stateId,
        { from: operatorA.address })
      assert.equal(res.logs[0].event, 'ConfigPending')
      await expect(
        applyDelayed({ res }, operatorA, smartAccount)
      ).to.be.revertedWith('apply called before due time')
      await testUtils.increaseTime(timeGap, web3)
      await expect(
        applyDelayed({ res }, operatorA, smartAccount)
      ).to.be.revertedWith('Use approveAddOperatorNow instead')
    })

    it('should cancel addOperatorNow operation', async function () {
      await expect(
        cancelDelayed({ res }, adminA, smartAccount)
      ).to.be.revertedWith(`permissions missing: ${Permissions.CanCancel}`)
      res = await cancelDelayed({ res }, watchdogA, smartAccount)
      assert.equal(res.logs[0].event, 'ConfigCancelled')
    })

    it('should add operator immediately with watchdog\'s approval', async function () {
      let participants = [operatorA.expect(), operatorB]
      await utils.validateConfigParticipants(participants, smartAccount)
      assert.equal(true, await smartAccount.isParticipant(adminA.address, adminA.permLevel))
      assert.equal(false, await smartAccount.isParticipant(operatorB.address, operatorB.permLevel))
      let stateId = await smartAccount.stateNonce()
      res = await smartAccount.addOperatorNow(operatorA.permLevel, operatorB.address, stateId,
        { from: operatorA.address })
      assert.equal(res.logs[0].event, 'ConfigPending')
      await expect(
        applyDelayed({ res }, adminA, smartAccount)
      ).to.be.revertedWith('apply called before due time')
      stateId = res.logs[0].args.stateId
      await expect(
        smartAccount.approveAddOperatorNow(adminA.permLevel, operatorB.address, stateId, operatorA.address,
          operatorA.permLevel, { from: adminA.address })
      ).to.be.revertedWith(`permissions missing: ${Permissions.CanApprove}`)
      await smartAccount.approveAddOperatorNow(watchdogA.permLevel, operatorB.address, stateId, operatorA.address,
        operatorA.permLevel, { from: watchdogA.address })
      participants = [operatorA.expect(), operatorB.expect()]
      assert.equal(true, await smartAccount.isParticipant(operatorB.address, operatorB.permLevel))
      await utils.validateConfigParticipants(participants, smartAccount)
    })

    it('should disable adding operator immediately', async function () {
      assert.equal(true, await smartAccount.allowAddOperatorNow())
      let stateId = await smartAccount.stateNonce()
      const actions = [ChangeType.SET_ADD_OPERATOR_NOW]
      // bool to bytes32 basically...
      const args = [Buffer.from('0'.repeat(64), 'hex')]
      res = await smartAccount.changeConfiguration(operatorA.permLevel, actions, args, args, stateId,
        { from: operatorA.address })
      assert.equal(res.logs[0].event, 'ConfigPending')
      await expect(
        applyDelayed({ res }, operatorA, smartAccount)
      ).to.be.revertedWith('apply called before due time')
      await testUtils.increaseTime(timeGap, web3)
      applyDelayed({ res }, operatorA, smartAccount)
      assert.equal(false, await smartAccount.allowAddOperatorNow())
      stateId = await smartAccount.stateNonce()
      await expect(
        smartAccount.addOperatorNow(operatorA.permLevel, operatorB.address, stateId, { from: operatorA.address })
      ).to.be.revertedWith('Call blocked')
    })

    it('should re-enable adding operator immediately', async function () {
      assert.equal(false, await smartAccount.allowAddOperatorNow())
      let stateId = await smartAccount.stateNonce()
      const actions = [ChangeType.SET_ADD_OPERATOR_NOW]
      // bool to bytes32 basically...
      const args = [Buffer.from('1'.repeat(64), 'hex')]
      res = await smartAccount.changeConfiguration(operatorA.permLevel, actions, args, args, stateId,
        { from: operatorA.address })
      assert.equal(res.logs[0].event, 'ConfigPending')
      await expect(
        applyDelayed({ res }, operatorA, smartAccount)
      ).to.be.revertedWith('apply called before due time')
      await testUtils.increaseTime(timeGap, web3)
      applyDelayed({ res }, operatorA, smartAccount)
      assert.equal(true, await smartAccount.allowAddOperatorNow())
      stateId = await smartAccount.stateNonce()
      res = await smartAccount.addOperatorNow(operatorA.permLevel, operatorB.address, stateId,
        { from: operatorA.address })
      await cancelDelayed({ res }, watchdogA, smartAccount)
    })

    it('should revert an attempt to add an operator immediately by anyone other than operator', async function () {
      const stateId = await smartAccount.stateNonce()
      await expect(
        smartAccount.addOperatorNow(adminA.permLevel, operatorB.address, stateId, { from: adminA.address })
      ).to.be.revertedWith(`permissions missing: ${Permissions.CanAddOperatorNow}`)
    })
  })

  describe('testing approval mechanism', function () {
    let failCloseGK
    let res

    before(async function () {
      failCloseGK = await SmartAccount.new(zeroAddress, accounts[0], { gas: 8e6 })
    })

    it('should initialize gk with failclose levels', async function () {
      initialDelays = Array.from({ length: 10 }, (x, i) => (i + 1) * dayInSec)
      requiredApprovalsPerLevel = [1, 1, 1, 2, 3, 2, 5, 6, 7, 8]
      initialParticipants.push(utils.bufferToHex(utils.participantHash(operatorZ.address, operatorZ.permLevel)))

      res = await failCloseGK.initialConfig(initialParticipants, initialDelays, true, true, requiredApprovalsPerLevel,
        [], [], [], { from: operatorA.address })
      const log = res.logs[0]
      assert.equal(log.event, 'SmartAccountInitialized')
    })

    it('should not approve non-exsiting change', async function () {
      const stateId = await failCloseGK.stateNonce()
      const changeType1 = ChangeType.ADD_PARTICIPANT
      const changeArg1 = utils.participantHash(adminB1.address, adminB1.permLevel)

      await expect(
        failCloseGK.approveConfig(watchdogA.permLevel, [changeType1], [changeArg1], [changeArg1], stateId,
          operatorA.address, operatorA.permLevel, zeroAddress, 0, { from: watchdogA.address })
      ).to.be.revertedWith('approve called for non existent pending change')
    })

    it('should schedule and approve operation that requires one approval', async function () {
      const stateId = await failCloseGK.stateNonce()
      const changeType1 = ChangeType.ADD_PARTICIPANT
      const changeArg1 = utils.participantHash(adminB1.address, adminB1.permLevel)
      await failCloseGK.changeConfiguration(operatorA.permLevel, [changeType1], [changeArg1], [changeArg1], stateId)

      await expect(
        failCloseGK.applyConfig(operatorA.permLevel, [changeType1], [changeArg1], [changeArg1], stateId,
          operatorA.address, operatorA.permLevel, zeroAddress, 0)
      ).to.be.revertedWith('called before due time')

      await testUtils.increaseTime(timeGap, web3)

      await expect(
        failCloseGK.applyConfig(operatorA.permLevel, [changeType1], [changeArg1], [changeArg1], stateId,
          operatorA.address, operatorA.permLevel, zeroAddress, 0)
      ).to.be.revertedWith('Pending approvals')

      await expect(
        failCloseGK.approveConfig(operatorA.permLevel, [changeType1], [changeArg1], [changeArg1], stateId,
          operatorA.address, operatorA.permLevel, zeroAddress, 0)
      ).to.be.revertedWith(`permissions missing: ${Permissions.CanApprove}`)

      await failCloseGK.approveConfig(watchdogA.permLevel, [changeType1], [changeArg1], [changeArg1], stateId,
        operatorA.address, operatorA.permLevel, zeroAddress, 0, { from: watchdogA.address })
      await failCloseGK.applyConfig(operatorA.permLevel, [changeType1], [changeArg1], [changeArg1], stateId,
        operatorA.address, operatorA.permLevel, zeroAddress, 0)
      await expect(
        failCloseGK.applyConfig(operatorA.permLevel, [changeType1], [changeArg1], [changeArg1], stateId,
          operatorA.address, operatorA.permLevel, zeroAddress, 0)
      ).to.be.revertedWith('apply called for non existent pending change')
    })

    it('should schedule and approve operation that requires two approvals', async function () {
      const stateId = await failCloseGK.stateNonce()
      const changeType1 = ChangeType.ADD_PARTICIPANT
      const changeArg1 = utils.participantHash(adminB1.address, adminB1.permLevel)
      res = await failCloseGK.changeConfiguration(operatorZ.permLevel, [changeType1], [changeArg1], [changeArg1],
        stateId, { from: operatorZ.address })

      const txhash = await utilities.transactionHashPublic([changeType1], [changeArg1], [changeArg1], stateId,
        operatorZ.address, operatorZ.permLevel, zeroAddress, 0)

      await expect(
        failCloseGK.applyConfig(operatorA.permLevel, [changeType1], [changeArg1], [changeArg1], stateId,
          operatorZ.address, operatorZ.permLevel, zeroAddress, 0)
      ).to.be.revertedWith('called before due time')

      await testUtils.increaseTime(5 * timeGap, web3)

      await expect(
        failCloseGK.applyConfig(operatorA.permLevel, [changeType1], [changeArg1], [changeArg1], stateId,
          operatorZ.address, operatorZ.permLevel, zeroAddress, 0)
      ).to.be.revertedWith('Pending approvals')

      await expect(
        failCloseGK.approveConfig(operatorA.permLevel, [changeType1], [changeArg1], [changeArg1], stateId,
          operatorZ.address, operatorZ.permLevel, zeroAddress, 0)
      ).to.be.revertedWith(`permissions missing: ${Permissions.CanApprove}`)

      await expect(
        failCloseGK.approveConfig(watchdogA.permLevel, [changeType1], [changeArg1], [changeArg1], stateId,
          operatorZ.address, operatorZ.permLevel, zeroAddress, 0, { from: watchdogA.address })
      ).to.be.revertedWith('cannot approve operation from higher level')

      await failCloseGK.approveConfig(watchdogZ.permLevel, [changeType1], [changeArg1], [changeArg1], stateId,
        operatorZ.address, operatorZ.permLevel, zeroAddress, 0, { from: watchdogZ.address })
      assert.equal((await failCloseGK.getPendingChange(txhash)).approvers.length, 1)
      await expect(
        failCloseGK.approveConfig(watchdogZ.permLevel, [changeType1], [changeArg1], [changeArg1], stateId,
          operatorZ.address, operatorZ.permLevel, zeroAddress, 0, { from: watchdogZ.address })
      ).to.be.revertedWith('Cannot approve twice')

      await expect(
        failCloseGK.applyConfig(operatorA.permLevel, [changeType1], [changeArg1], [changeArg1], stateId,
          operatorZ.address, operatorZ.permLevel, zeroAddress, 0)
      ).to.be.revertedWith('Pending approvals')

      await expect(
        cancelDelayed({ res }, watchdogA, failCloseGK)
      ).to.be.revertedWith('cannot cancel, scheduler is of higher level')
      await cancelDelayed({ res }, watchdogZ, failCloseGK)
    })
  })

  /* Owner finds the phone after losing it */
  it('should allow the owner to cancel an owner change')

  /* Owner finds the phone after losing it */
  it('should allow the admin to cancel an owner change')

  /* doomsday recover: all participants malicious */
  it('should allow the super-admin to lock out all participants, cancel all operations and replace all participants')

  /* Negative flows */

  /* Owner’s phone controlled by a malicious operator */
  it('should not allow the owner to cancel an owner change if an admin locks him out')

  it('should allow the cancellers to cancel a delayed transfer transaction', async function () {
    await utils.asyncForEach(
      [operatorA, watchdogA],
      async (participant) => {
        const stateId = await smartAccount.stateNonce()
        const res1 = await smartAccount.scheduleBypassCall(operatorA.permLevel, destinationAddress, amount, [], stateId)
        expectedDelayedEventsCount++
        const log1 = res1.logs[0]

        const res2 = await smartAccount.cancelBypassCall(
          participant.permLevel,
          log1.args.sender,
          log1.args.senderPermsLevel,
          log1.args.stateId,
          log1.args.target,
          log1.args.value,
          [],
          { from: participant.address })
        const log2 = res2.logs[0]
        assert.equal(log2.event, 'BypassCallCancelled')
        assert.equal(log2.address, log1.address)
      })
  })

  function getNonSpenders () {
    return [
      adminA.expectError(`permissions missing: ${Permissions.CanSpend}`),
      watchdogA.expectError(`permissions missing: ${Permissions.CanSpend}`),
      wrongaddr.expectError('not participant')
    ]
  }

  function getNonConfigChangers () {
    return [
      adminA.expectError(`permissions missing: ${Permissions.CanChangeParticipants + Permissions.CanUnfreeze +
      Permissions.CanChangeBypass + Permissions.CanSetAcceleratedCalls + Permissions.CanSetAddOperatorNow + Permissions.CanAddOperatorNow}`),
      watchdogA.expectError(`permissions missing: ${Permissions.CanChangeConfig}`),
      wrongaddr.expectError('not participant')
    ]
  }

  function getNonBoostees () {
    return [
      adminA.expectError(`permissions missing: ${Permissions.CanSignBoosts + Permissions.CanUnfreeze +
      Permissions.CanChangeParticipants + Permissions.CanChangeBypass + Permissions.CanSetAcceleratedCalls +
      Permissions.CanSetAddOperatorNow + Permissions.CanAddOperatorNow}`),
      watchdogA.expectError(`permissions missing: ${Permissions.CanSignBoosts + Permissions.CanChangeConfig}`),
      wrongaddr.expectError('not participant')
    ]
  }

  // it(`should not allow non-chowners to change owner`, async function () {
  //     let stateId = await smartAccount.stateNonce();
  //     await utils.asyncForEach(getNonChowners(), async (participant) => {
  //         await expect(
  //             smartAccount.scheduleChangeOwner(participant.permLevel, adminC.address, stateId, {from: participant.address})
  //         ).to.be.revertedWith(participant.expectError);
  //         console.log(`${participant.name} + scheduleChangeOwner + ${participant.expectError}`)
  //     });
  // });

  /* Admin replaced - opposite  & Owner loses phone - opposite */
  it('should not allow non-config-changers to add or remove admins or watchdogs', async function () {
    const stateId = await smartAccount.stateNonce()
    await utils.asyncForEach(getNonConfigChangers(), async (participant) => {
      let actions = [ChangeType.ADD_PARTICIPANT]
      let args = [utils.participantHash(adminC.address, adminC.permLevel)]
      await expect(
        smartAccount.changeConfiguration(participant.permLevel, actions, args, args, stateId,
          { from: participant.address })
      ).to.be.revertedWith(participant.expectError)
      console.log(`${participant.name} + addParticipant + ${participant.expectError}`)

      actions = [ChangeType.REMOVE_PARTICIPANT]
      args = [utils.participantHash(adminA.address, adminA.permLevel)]
      await expect(
        smartAccount.changeConfiguration(participant.permLevel, actions, args, args, stateId,
          { from: participant.address })
      ).to.be.revertedWith(participant.expectError)
      console.log(`${participant.name} + removeParticipant + ${participant.expectError}`)
    })
  })

  it.skip('should not allow non-spenders to create a delayed transfer transaction', async function () {
    const stateId = await smartAccount.stateNonce()
    await utils.asyncForEach(getNonSpenders(), async (participant) => {
      await expect(
        smartAccount.sendEther(destinationAddress, amount, participant.permLevel, initialDelays[1], stateId,
          { from: participant.address })
      ).to.be.revertedWith(participant.expectError)
      console.log(`${participant.name} + sendEther + ${participant.expectError}`)
    })
  })

  it.skip('should not allow non-spenders to create a delayed ERC20 transfer transaction', async function () {
    const stateId = await smartAccount.stateNonce()
    await utils.asyncForEach(getNonSpenders(), async (participant) => {
      await expect(
        smartAccount.sendERC20(destinationAddress, amount, participant.permLevel, initialDelays[1], erc20.address,
          stateId, { from: participant.address })
      ).to.be.revertedWith(participant.expectError)
      console.log(`${participant.name} + sendERC20 + ${participant.expectError}`)
    })
  })

  it.skip('should not allow participant.title to freeze', async function () {

  })

  it('should not allow to freeze level that is higher than the caller\'s')
  it('should not allow to freeze for zero time')
  it('should not allow to freeze for enormously long time')

  // TODO: separate into 'isFrozen' check and a separate tests for each disabled action while frozen
  it('should allow the watchdog to freeze all participants below its level', async function () {
    let stateId = await smartAccount.stateNonce()
    let res0
    {
      const actions = [ChangeType.ADD_PARTICIPANT]
      const args = [utils.participantHash(watchdogB.address, watchdogB.permLevel)]
      res0 = await smartAccount.changeConfiguration(operatorA.permLevel, actions, args, args, stateId)
      await testUtils.increaseTime(timeGap, web3)
      await applyDelayed({ res: res0 }, operatorA, smartAccount)
    }

    await utils.validateConfigParticipants([
      operatorA.expect(),
      watchdogA.expect(),
      watchdogB.expect(),
      adminA.expect(),
      adminB1.expect()
    ], smartAccount)

    // set interval longer then delay, so that increase time doesn't unfreeze the smartAccount
    const interval = timeGap * 2
    const res = await smartAccount.freeze(watchdogB.permLevel, level, interval, { from: watchdogB.address })
    const block = await web3.eth.getBlock(res.receipt.blockNumber)
    const log = res.logs[0]
    assert.equal(log.event, 'LevelFrozen')
    assert.equal(log.args.frozenLevel, level)
    assert.equal(log.args.frozenUntil.toNumber(), block.timestamp + interval)
    assert.equal(log.args.sender, watchdogB.address)

    // Operator cannot send money any more
    const reason = 'level is frozen'
    stateId = await smartAccount.stateNonce()
    await expect(
      smartAccount.scheduleBypassCall(operatorA.permLevel, destinationAddress, amount, [], stateId,
        { from: operatorA.address })
    ).to.be.revertedWith(reason)

    // On lower levels:
    // Operator cannot change configuration any more
    const actions = [ChangeType.ADD_PARTICIPANT]
    const args = [utils.participantHash(adminC.address, adminC.permLevel)]
    await expect(
      smartAccount.changeConfiguration(operatorA.permLevel, actions, args, args, stateId),
      'addParticipant did not revert correctly' +
      ` with expected reason: "${reason}"`
    ).to.be.revertedWith(reason)

    // Admin cannot change owner any more
    // await expect(
    //     smartAccount.scheduleChangeOwner(adminA.permLevel, adminC.address, stateId, {from: adminA.address}),
    //     "scheduleChangeOwner did not revert correctly"
    //     + ` with expected reason: "${reason}"`
    // ).to.be.revertedWith(reason);

    // Watchdog cannot cancel operations any more
    await expect(
      cancelDelayed({ res: res0 }, watchdogA, smartAccount),
      'cancelOperation did not revert correctly' +
      ` with expected reason: "${reason}"`
    ).to.be.revertedWith(reason)

    await expect(
      smartAccount.cancelBypassCall(watchdogA.permLevel, operatorA.address, operatorA.permLevel, 0, zeroAddress, 0, [],
        { from: watchdogA.address }),
      'cancelTransfer did not revert correctly' +
      ` with expected reason: "${reason}"`
    ).to.be.revertedWith(reason)

    // On the level of the freezer or up:
    // Admin can still call 'change owner'
    // let res2 = await smartAccount.scheduleChangeOwner(adminB2.permLevel, operatorB.address, stateId, {from: adminB2.address});

    // Watchdog can still cancel stuff
    // let res3 = await cancelDelayed({res: res2}, watchdogB, smartAccount);
    // assert.equal(res3.logs[0].event, "ConfigCancelled");
  })

  it('should not allow to shorten the length of a freeze')
  it('should not allow to lower the level of the freeze')

  it('should not allow non-boosters to unfreeze', async function () {
    await utils.asyncForEach(getNonBoostees(), async (signingParty) => {
      const actions = [ChangeType.UNFREEZE]
      const args = ['0x0']
      const stateId = await smartAccount.stateNonce()
      const encodedHash = await utilities.changeHash(actions, args, args, stateId)// utils.getTransactionHash(ABI.solidityPack(["uint8[]", "bytes32[]", "uint256"], [actions, args, stateId]));
      const signature = await utils.signMessage(encodedHash, web3, { from: signingParty.address })
      await expect(
        smartAccount.boostedConfigChange(
          adminB1.permLevel,
          actions,
          args,
          args,
          stateId,
          signingParty.permLevel,
          signature,
          { from: adminB1.address })
      ).to.be.revertedWith(signingParty.expectError)

      console.log(`${signingParty.name} + boostedConfigChange + ${signingParty.expectError}`)
    })
  })

  it('should allow owner and admin together to unfreeze', async function () {
    // Meke sure smartAccount is still frozen
    const frozenLevel = await smartAccount.frozenLevel()
    const frozenUntil = parseInt(await smartAccount.frozenUntil()) * 1000
    assert.equal(frozenLevel, operatorA.level)
    const oneHourMillis = 60 * 60 * 1000
    assert.isAtLeast(frozenUntil, Date.now() + oneHourMillis)

    // Schedule a boosted unfreeze by a high level admin
    const actions = [ChangeType.UNFREEZE]
    const args = ['0x0']
    let stateId = await smartAccount.stateNonce()
    const encodedHash = await utilities.changeHash(actions, args, args, stateId)// utils.getTransactionHash(ABI.solidityPack(["uint8[]", "bytes32[]", "uint256"], [actions, args, stateId]));
    const signature = await utils.signMessage(encodedHash, web3, { from: operatorA.address })
    const res1 = await smartAccount.boostedConfigChange(adminB1.permLevel, actions, args, args, stateId,
      operatorA.permLevel, signature, { from: adminB1.address })
    const log1 = res1.logs[0]

    assert.equal(log1.event, 'ConfigPending')

    // Execute the scheduled unfreeze
    await testUtils.increaseTime(timeGap, web3)

    // Operator still cannot send money, not time-caused unfreeze
    stateId = await smartAccount.stateNonce()
    await expect(
      smartAccount.scheduleBypassCall(operatorA.permLevel, destinationAddress, amount, [], stateId,
        { from: operatorA.address })
    ).to.be.revertedWith('level is frozen')
    const res3 = await applyDelayed({ log: log1 }, adminB1, smartAccount)
    const log3 = res3.logs[0]

    assert.equal(log3.event, 'UnfreezeCompleted')
    stateId = await smartAccount.stateNonce()
    const res2 = await smartAccount.scheduleBypassCall(operatorA.permLevel, destinationAddress, amount, [], stateId,
      { from: operatorA.address })
    expectedDelayedEventsCount++
    const log2 = res2.logs[0]
    assert.equal(log2.event, 'BypassCallPending')
    assert.equal(log2.address, smartAccount.address)
  })

  describe('when schedule happens before freeze', function () {
    it('should not allow to apply an already scheduled Delayed Op if the scheduler\'s rank is frozen',
      async function () {
        // Schedule a totally valid config change
        const actions = [ChangeType.ADD_PARTICIPANT]
        const args = [utils.participantHash(adminB1.address, adminB1.permLevel)]
        const stateId = await smartAccount.stateNonce()
        const res1 = await smartAccount.changeConfiguration(operatorA.permLevel, actions, args, args, stateId)

        // Freeze the scheduler's rank
        await smartAccount.freeze(watchdogB.permLevel, level, timeGap, { from: watchdogB.address })

        // Sender cannot apply anything - he is frozen
        await expect(
          applyDelayed({ res: res1 }, operatorA, smartAccount)
        ).to.be.revertedWith('level is frozen')

        // Somebody who can apply cannot apply either
        await expect(
          applyDelayed({ res: res1 }, adminB1, smartAccount)
        ).to.be.revertedWith('scheduler level is frozen')
      })

    // TODO: actually call unfreeze, as the state is different. Actually, this is a bit of a problem. (extra state: outdated freeze). Is there a way to fix it?
    it('should not allow to apply an already scheduled boosted Delayed Op if the booster\'s rank is also frozen',
      async function () {
        // Schedule a boosted unfreeze by a high level admin

        const actions = [ChangeType.UNFREEZE]
        const args = ['0x0']
        const stateId = await smartAccount.stateNonce()
        const encodedHash = await utilities.changeHash(actions, args, args, stateId)// utils.getTransactionHash(ABI.solidityPack(["uint8[]", "bytes32[]", "uint256"], [actions, args, stateId]));
        const signature = await utils.signMessage(encodedHash, web3, { from: operatorA.address })
        const res1 = await smartAccount.boostedConfigChange(
          adminB1.permLevel,
          actions,
          args,
          args,
          stateId,
          operatorA.permLevel,
          signature,
          { from: adminB1.address })
        const log1 = res1.logs[0]
        assert.equal(log1.event, 'ConfigPending')

        // Increase freeze level to one above the old booster level
        await smartAccount.freeze(watchdogZ.permLevel, highLevel, timeGap, { from: watchdogZ.address })

        // Admin with level 5 tries to apply the boosted operation
        await expect(
          applyDelayed({ res: res1 }, adminZ, smartAccount)
        ).to.be.revertedWith('booster level is frozen')
      })
  })

  it('should automatically unfreeze after a time interval')

  it('should revert an attempt to unfreeze if smartAccount is not frozen')

  it('should validate correctness of claimed senderPermissions')
  it('should validate correctness of claimed sender address')
  it('should not allow any operation to be called without a delay')
  it('should only allow delayed calls to whitelisted operations')

  it('should revert an attempt to apply an operation under some other participant\'s name', async function () {
    // Schedule config change by operator, and claim to be an admin when applying
    const stateId = await smartAccount.stateNonce()
    const changeType = ChangeType.ADD_PARTICIPANT
    const changeArgs = utils.participantHash(adminB1.address, adminB1.permLevel)

    await smartAccount.changeConfiguration(operatorA.permLevel, [changeType], [changeArgs], [changeArgs], stateId)

    await testUtils.increaseTime(timeGap, web3)
    // adminA cannot apply it - will not find it by hash
    await expect(
      smartAccount.applyConfig(adminA.permLevel, [changeType], [changeArgs], [changeArgs], stateId, adminA.address,
        adminA.permLevel, zeroAddress, 0, { from: adminA.address })
    ).to.be.revertedWith('apply called for non existent pending change')
  })

  it('should revert an attempt to apply a boosted operation under some other participant\'s name')

  it('should revert an attempt to apply a boosted operation claiming wrong permissions')
  it('should revert an attempt to apply an operation claiming wrong permissions')

  it('should revert an attempt to schedule a transaction if the target state nonce is incorrect', async function () {
    const stateId = await smartAccount.stateNonce()
    const changeType = ChangeType.ADD_PARTICIPANT
    const changeArgs = utils.participantHash(adminB1.address, adminB1.permLevel)

    await expect(
      smartAccount.changeConfiguration(operatorA.permLevel, [changeType], [changeArgs], [changeArgs], stateId - 1)
    ).to.be.revertedWith('contract state changed since transaction was created')
  })

  it('should save the block number of the deployment transaction', async function () {
    // not much to check here - can't know the block number
    const deployedBlock = (await smartAccount.deployedBlock()).toNumber()
    assert.isAbove(deployedBlock, 0)
  })

  after('write coverage report', async () => {
    await global.postCoverage()
  })
})

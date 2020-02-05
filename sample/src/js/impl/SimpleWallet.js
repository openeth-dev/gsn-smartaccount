import abiDecoder from 'abi-decoder'
import asyncForEach from 'async-await-foreach'
import Web3 from 'web3'

import Permissions from 'safechannels-contracts/src/js/Permissions'
import Participant from 'safechannels-contracts/src/js/Participant'
import SafeChannelUtils from 'safechannels-contracts/src/js/SafeChannelUtils'
import FactoryContractInteractor from 'safechannels-contracts/src/js/FactoryContractInteractor'

import SimpleWalletApi from '../api/SimpleWallet.api'
import DelayedTransfer from '../etc/DelayedTransfer'
import DelayedContractCall from '../etc/DelayedContractCall'
import DelayedConfigChange from '../etc/DelayedConfigChange'
import ConfigEntry from '../etc/ConfigEntry'
import { changeTypeToString } from '../etc/ChangeType'
import { nonNull } from '../utils/utils'
import EventsEmitter from 'events'

const erc20Methods = ['0xa9059cbb', '0x095ea7b3']
const BypassEventNames = {
  pending: 'BypassCallPending',
  applied: 'BypassCallApplied',
  cancelled: 'BypassCallCancelled'
}
const ConfigEventNames = {
  pending: 'ConfigPending',
  applied: 'ConfigApplied',
  cancelled: 'ConfigCancelled'
}

const dueFilter = function (blockchainTime) {
  return (it) => it.args.dueTime.toNumber() < blockchainTime
}

export default class SimpleWallet extends SimpleWalletApi {
  /**
   *
   * @param contract - TruffleContract instance of the Gatekeeper
   * @param participant - the participant to be used as the 'from' of all operations
   * @param backend - implementation of {@link ClientBackend}
   * @param whitelistFactory - instance ow Truffle Contract for whitelist deployment
   * @param knownTokens - tokens currently supported.
   */
  constructor ({
    contract,
    participant,
    backend,
    whitelistFactory,
    knownTokens = []
  }) {
    super()
    nonNull({ contract, participant })
    this.contract = contract
    this.backend = backend
    this.participant = participant
    this.whitelistFactory = whitelistFactory
    this.knownTokens = knownTokens
    abiDecoder.addABI(FactoryContractInteractor.getErc20ABI())
    // TODO: make sure no duplicates
  }

  async initialConfiguration (configuration) {
    return this.contract.initialConfig(
      configuration.initialParticipants,
      configuration.initialDelays,
      configuration.allowAcceleratedCalls,
      configuration.requiredApprovalsPerLevel,
      configuration.bypassTargets,
      configuration.bypassMethods,
      configuration.bypassModules,
      {
        from: this.participant.address,
        gas: 1e6
      }
    )
  }

  async transfer ({ destination, amount, token }) {
    let destinationAddress
    let ethAmount
    let encodedTransaction
    let whitelisted = false
    if (token === 'ETH') {
      whitelisted = await this._isBypassActivated({ target: destination, value: amount, encodedFunction: '0x' })
      destinationAddress = destination
      ethAmount = amount
      encodedTransaction = []
    } else {
      destinationAddress = this._getTokenAddress(token)
      ethAmount = 0
      encodedTransaction = FactoryContractInteractor.encodeErc20Call({ destination, amount, operation: 'transfer' })
      whitelisted = await this._isBypassActivated({
        target: destinationAddress,
        value: ethAmount,
        encodedFunction: encodedTransaction
      })
    }
    let method
    if (whitelisted) {
      // uint32 senderPermsLevel, address target, uint256 value, bytes memory encodedFunction, uint256 targetStateNonce
      method = this.contract.executeBypassCall
    } else {
      method = this.contract.scheduleBypassCall
    }
    return method(
      this.participant.permLevel, destinationAddress, ethAmount, encodedTransaction, this.stateId,
      {
        from: this.participant.address,
        gas: 1e8
      })
  }

  removeOperator (addr) {
  }

  async cancelPending (delayedOpId) {
    let isConfig = true
    let pending = await this.contract.getPastEvents('ConfigPending',
      {
        filter: {
          delayedOpId
        },
        fromBlock: this.deployedBlock,
        toBlock: 'latest'
      }
    )
    if (pending.length === 0) {
      isConfig = false
      pending = await this.contract.getPastEvents('BypassCallPending',
        {
          filter: {
            delayedOpId
          },
          fromBlock: this.deployedBlock,
          toBlock: 'latest'
        }
      )
    }
    if (pending.length === 0) {
      throw Error(`Could not find a pending operation with id: ${delayedOpId}`)
    }
    const args = pending[0].args
    if (isConfig) {
      return this.contract.cancelOperation(
        this.participant.permLevel,
        args.actions,
        args.actionsArguments1,
        args.actionsArguments2,
        args.stateId,
        args.sender,
        args.senderPermsLevel,
        args.booster,
        args.boosterPermsLevel,
        {
          from: this.participant.address,
          gas: 1e6
        }
      )
    } else {
      const msgdata = args.msgdata || '0x'
      return this.contract.cancelBypassCall(
        this.participant.permLevel,
        args.sender,
        args.senderPermsLevel,
        args.stateId,
        args.target,
        args.value,
        msgdata,
        {
          from: this.participant.address,
          gas: 1e6
        }
      )
    }
  }

  refresh () {
  }

  transferWhiteList ({ destination, amount, token }) {
  }

  addWhitelist (addrs) {
  }

  removeWhitelist (addrs) {
  }

  // return cached list of whitelisted addresses.
  listWhitelistedAddresses () {
  }

  async isOperator (address) {
    const info = await this.getWalletInfo()
    if ((info).participants.find(it => it.address.toLowerCase() === address.toLowerCase())) {
      return true
    }
    return false
  }

  async isOperatorOrPending (address) {
    if (await this.isOperator(address)) { return true }

    const pending = await this.listPendingConfigChanges()
    const op = pending && pending[0] && pending[0].operations && pending[0].operations[0]
    if (!op) { return false }
    if (op.type === 'add_operator' &&
      op.args[0].indexOf(address.replace(/0x/, '')) > 0) {
      return true
    }
    return false
  }

  // TODO: currently only initialConfig is checked. Must iterate over all config events to figure out the actual info.
  // TODO: split into two: scan events and interpret events.
  // TODO: add some caching mechanism then to avoid re-scanning entire history on every call
  async getWalletInfo () {
    this.stateId = await this.contract.stateNonce()
    const { allowAcceleratedCalls } = await this._getAllowedFlags()
    const { initEvent, participantAddedEvents } = await this._getCompletedConfigurationEvents()
    const args = initEvent.args
    const foundParticipants = this._findParticipants({ initEvent, participantAddedEvents })

    const participants = foundParticipants.map(it => {
      let type // TODO: move to participant class
      switch (Number(it.permissions)) {
        case Permissions.WatchdogPermissions:
          type = 'watchdog'
          break
        case Permissions.AdminPermissions:
          type = 'admin'
          break
        case Permissions.OwnerPermissions:
          type = 'operator'
          break
        default:
          type = 'unknown-' + it.permissions // not that we can do something with it..
      }
      return {
        address: it.address,
        level: it.level,
        type: type
      }
    })
    const levels = []
    for (let i = 0; i < args.delays.length; i++) {
      levels[i] = {
        delay: args.delays[i].toString(),
        requiredApprovals: args.requiredApprovalsPerLevel[i].toString()
      }
    }
    return {
      address: initEvent.address,
      options: {
        allowAcceleratedCalls
      },
      participants,
      levels: levels
    }
  }

  async _getEmitter () {
    const { web3 } = this._getWeb3()

    if (!this._eventsEmitter) {
      let lastBlock = await this._getDeployedBlock()

      const _eventsEmitter = new EventsEmitter()
      this._eventsEmitter = _eventsEmitter
      setInterval(async () => {
        const block = await web3.eth.getBlock('latest')
        if (block.number === lastBlock) {
          return
        }
        const events = await this.contract.getPastEvents({
          fromBlock: lastBlock
        })
        lastBlock = block
        if (events.length) {
          _eventsEmitter.emit('events', events)
        }
      }, 1000)
    }
    return this._eventsEmitter
  }

  async unsubscribe (observer) {
    const emitter = await this._getEmitter()
    await emitter.off('events', observer)
  }

  async subscribe (observer) {
    // make sure each observer exists only once
    await this.unsubscribe(observer)
    const emitter = await this._getEmitter()
    emitter.on('events', observer)
  }

  /**
   *  TODO: add support for removing participant
   *  TODO: add support for unknown participants
   */
  _findParticipants ({ initEvent, participantAddedEvents }) {
    const participants = initEvent.args.participants.map(it => {
      return Participant.parse(it)
    })
    participantAddedEvents.forEach(event => {
      participants.push(
        new Participant(event.args.participant, event.args.permissions.toString(), event.args.level.toString()))
    })
    return participants
  }

  async _getAllowedFlags () {
    const allowAcceleratedCalls = await this.contract.allowAcceleratedCalls()
    return { allowAcceleratedCalls }
  }

  async _getCompletedConfigurationEvents () {
    const deployedBlock = await this._getDeployedBlock()
    const _fromBlock = this.deployedBlock || 0
    const _toBlock = 'latest'
    const participantAddedEvents = await this.contract.getPastEvents('ParticipantAdded', {
      fromBlock: _fromBlock,
      toBlock: _toBlock
    })
    const initEvent = (await this.contract.getPastEvents('SmartAccountInitialized', {
      fromBlock: deployedBlock,
      toBlock: 'latest'
    }))[0]
    return { participantAddedEvents, initEvent }
  }

  async listTokens () {
    const { provider, web3 } = this._getWeb3()
    const smartAccount = this.contract.address
    const ethBalance = await web3.eth.getBalance(smartAccount)
    const tokenBalances = await Promise.all(this.knownTokens.map(
      async (address) => {
        const erc20 = await FactoryContractInteractor.getErc20ContractAt({ address, provider })
        const balance = (await erc20.balanceOf(smartAccount)).toString()
        let decimals
        let symbol
        try {
          decimals = (await erc20.decimals()).toString()
          symbol = await erc20.symbol()
        } catch (e) {
          decimals = 18
          symbol = 'N/A'
        }
        return {
          balance, decimals, symbol
        }
      }))
    return [
      { balance: ethBalance, decimals: 18, symbol: 'ETH' },
      ...tokenBalances
    ]
  }

  _getWeb3 () {
    const provider = this.contract.contract.currentProvider
    if (!this.web3) { this.web3 = new Web3(provider) }
    return { provider, web3: this.web3 }
  }

  async _getDeployedBlock () {
    if (!this.deployedBlock) {
      this.deployedBlock = (await this.contract.deployedBlock()).toNumber()
    }
    return this.deployedBlock
  }

  async listPendingConfigChanges () {
    const pastTransactionEvents = await this._getPastEvents({ type: 'transaction' })
    const activeBypassPolicies = await this.listBypassPolicies()
    const bypassCalls = pastTransactionEvents.pendingEvents.filter(it => {
      return activeBypassPolicies.includes(it.args.target)
    }).map((it) => {
      // TODO: if needed, support other types of bypass policy config changes; parse parameters
      const entry = new ConfigEntry({
        type: 'whitelist_change',
        args: ['TODO'],
        targetModule: it.args.destination
      })
      const operations = [entry]
      return new DelayedConfigChange({
        txHash: it.transactionHash,
        delayedOpId: it.args.delayedOpId,
        dueTime: it.args.dueTime.toNumber(),
        state: 'mined',
        operations: operations
      })
    })
    const pastConfigEvents = await this._getPastEvents({ type: 'config' })
    const configChanges = pastConfigEvents.pendingEvents.map((it) => {
      const operations = []
      const common = {
        txHash: it.transactionHash,
        delayedOpId: it.args.delayedOpId,
        dueTime: parseInt(it.args.dueTime.toString()), // not sure why its not BN here
        state: 'mined'
      }
      for (let i = 0; i < it.args.actions.length; i++) {
        const type = changeTypeToString(it.args.actions[i])
        let args = [it.args.actionsArguments1[i], it.args.actionsArguments2[i]]
        // TODO: parse all args types to human-readable format
        // This is a hack to make one specific test pass. Will be fixed as more tests are added
        if (type === 'add_operator_now') {
          args = [SafeChannelUtils.decodeParticipant(args[0]).address]
        }
        operations.push(new ConfigEntry({ type, args }))
      }
      return new DelayedConfigChange({
        ...common,
        operations: operations
      })
    })
    return [...bypassCalls, ...configChanges]
  }

  async listPendingTransactions () {
    const pastTransactionEvents = await this._getPastEvents({ type: 'transaction' })
    const allPendingTransactions = pastTransactionEvents.pendingEvents
    const activeBypassPolicies = await this.listBypassPolicies()
    return allPendingTransactions.filter(it => {
      return !activeBypassPolicies.includes(it.args.target)
    }).map(
      (it) => {
        const isEtherValuePassed = it.args.value.toString() !== '0'
        const isDataPassed = it.args.msgdata && it.args.msgdata.length > 0
        const isErc20Method = isDataPassed && erc20Methods.includes(it.args.msgdata.substr(0, 10))
        // TODO: get all data from events, save roundtrips here
        const common = {
          txHash: it.transactionHash,
          delayedOpId: it.args.delayedOpId,
          dueTime: it.args.dueTime.toString(),
          state: 'mined'
        }
        if (isEtherValuePassed && !isDataPassed) {
          return new DelayedTransfer({
            ...common,
            operation: 'transfer',
            tokenSymbol: 'ETH',
            value: it.args.value.toString(),
            destination: it.args.target
          })
        } else if (isErc20Method) {
          const parsedErc20 = this._parseErc20Transaction({
            target: it.args.target,
            data: it.args.msgdata
          })
          return new DelayedTransfer({
            ...common,
            ...parsedErc20
          })
        } else {
          return new DelayedContractCall({
            ...common,
            value: it.args.value,
            destination: it.args.target,
            data: it.args.msgdata
          })
        }
      }
    )
  }

  async _getRawPastEvents (type, fromBlock, toBlock) {
    let eventNames
    if (type === 'config') {
      eventNames = ConfigEventNames
    } else if (type === 'transaction') {
      eventNames = BypassEventNames
    } else {
      throw Error(`unknown operation type: ${type}`)
    }
    // TODO: remove the ||, support only the most used flow
    const _fromBlock = fromBlock || this.deployedBlock || 0
    const _toBlock = toBlock || 'latest'
    const scheduledEvents = await this.contract.getPastEvents(eventNames.pending, {
      fromBlock: _fromBlock,
      toBlock: _toBlock
    })
    const completedEvents = await this.contract.getPastEvents(eventNames.applied, {
      fromBlock: _fromBlock,
      toBlock: _toBlock
    })
    const cancelledEvents = await this.contract.getPastEvents(eventNames.cancelled, {
      fromBlock: _fromBlock,
      toBlock: _toBlock
    })
    return { scheduledEvents, completedEvents, cancelledEvents }
  }

  async _getPastEvents ({ type, fromBlock, toBlock }) {
    const { scheduledEvents, completedEvents, cancelledEvents } = await this._getRawPastEvents(type, fromBlock, toBlock)
    const completedEventsHashes = completedEvents.map(it => it.args.delayedOpId)
    const cancelledEventsHashes = cancelledEvents.map(it => it.args.delayedOpId)
    const pendingEvents = scheduledEvents.filter(it => {
      return !completedEventsHashes.includes(it.args.delayedOpId) &&
        !cancelledEventsHashes.includes(it.args.delayedOpId)
    })
    return {
      scheduledEvents, completedEvents, cancelledEvents, pendingEvents
    }
  }

  listBypassPolicies () {
    return []
  }

  static getDefaultSampleInitialConfiguration ({ backendAddress, operatorAddress, whitelistModuleAddress }) {
    const backendAsWatchdog = '0x' +
      SafeChannelUtils.encodeParticipant({
        address: backendAddress,
        permissions: Permissions.WatchdogPermissions,
        level: 1
      }).toString('hex')
    const backendAsAdmin = '0x' +
      SafeChannelUtils.encodeParticipant({
        address: backendAddress,
        permissions: Permissions.AdminPermissions,
        level: 1
      }).toString('hex')
    const operator = '0x' +
      SafeChannelUtils.encodeParticipant({
        address: operatorAddress,
        permissions: Permissions.OwnerPermissions,
        level: 1
      }).toString('hex')
    const bypassModules = []
    const bypassMethods = []
    if (whitelistModuleAddress) {
      // We need the same module defined for no msgData and each erc20 method
      const erc20methods = ['0x00000000', '0xa9059cbb', '0x095ea7b3']
      bypassMethods.push(...erc20methods)
      for (let i = 0; i < bypassMethods.length; i++) {
        bypassModules.push(whitelistModuleAddress)
      }
    }
    return {
      initialParticipants: [operator, backendAsWatchdog, backendAsAdmin],
      initialDelays: [86400, 172800],
      allowAcceleratedCalls: true,
      requiredApprovalsPerLevel: [1, 0],
      bypassTargets: [],
      bypassMethods,
      bypassModules
    }
  }

  _parseErc20Transaction ({ target, data }) {
    const token = this.knownTokens.find(it => it.address === target)
    const symbol = token ? token.name : 'N/A'
    const dec = abiDecoder.decodeMethod(data)
    return {
      operation: dec.name,
      tokenSymbol: symbol,
      value: dec.params[1].value,
      destination: dec.params[0].value
    }
  }

  // _parseErc20Transaction ({ target, data }) {
  //   return { tokenSymbol, operation, value, destination }
  // }

  _getTokenAddress (token) {
    return this.knownTokens.find(it => it.name === token).address
  }

  async addOperatorNow (newOperator) {
    return this.contract.addOperatorNow(this.participant.permLevel, newOperator, this.stateId,
      {
        from: this.participant.address,
        gas: 1e6
      })
    // TODO: Add new operator to known participants
  }

  async validateAddOperatorNow ({ jwt, smsCode }) {
    return this.backend.validateAddOperatorNow({ jwt, smsCode })
  }

  // TODO: this code is not really covered with tests! Do not trust it!
  async applyAllPendingOperations () {
    const block = await this._getWeb3().web3.eth.getBlock('latest')
    const blockchainTime = block.timestamp
    const configEvents = await this._getPastEvents({ type: 'config' })
    const dueConfigChanges = configEvents.pendingEvents.filter(dueFilter(blockchainTime))
    const applyReceipts = []
    await asyncForEach(dueConfigChanges, async (it) => {
      const applyConfig = await this.contract.applyConfig(
        this.participant.permLevel,
        it.args.actions,
        it.args.actionsArguments1,
        it.args.actionsArguments2,
        it.args.stateId,
        it.args.sender,
        it.args.senderPermsLevel.toNumber(),
        it.args.booster,
        it.args.boosterPermsLevel.toNumber(),
        { from: this.participant.address }
      )
      applyReceipts.push(applyConfig)
    })
    const transferEvents = await this._getPastEvents({ type: 'transaction' })
    const dueTransactions = transferEvents.pendingEvents.filter(dueFilter(blockchainTime))
    await asyncForEach(dueTransactions, async (it) => {
      const encodedFunction = it.args.msgdata || []
      const applyCall = await this.contract.applyBypassCall(
        this.participant.permLevel,
        it.args.sender,
        it.args.senderPermsLevel,
        it.args.stateId,
        it.args.target,
        it.args.value,
        encodedFunction,
        { from: this.participant.address }
      )
      applyReceipts.push(applyCall)
    })

    return applyReceipts
  }

  _addKnownToken (address) {
    this.knownTokens.push(address)
  }

  async scheduleAddOperator ({ newOperator }) {
    await this.contract.scheduleAddOperator(
      this.participant.permLevel, newOperator, this.stateId,
      {
        from: this.participant.address,
        gas: 1e8
      }
    )
  }

  async deployWhitelistModule ({ whitelistPreconfigured }) {
    return this.whitelistFactory.newWhitelist(this.contract.address, whitelistPreconfigured,
      {
        from: this.participant.address
      })
  }

  async _isBypassActivated ({ target, value, encodedFunction }) {
    const policy = await this.contract.getBypassPolicy(target, value, encodedFunction)
    return policy[0].toString() === '0' && policy[1].toString() === '0'
  }
}

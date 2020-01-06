import abiDecoder from 'abi-decoder'
import asyncForEach from 'async-await-foreach'
import Web3 from 'web3'

import Permissions from 'safechannels-contracts/src/js/Permissions'
import SafeChannelUtils from 'safechannels-contracts/src/js/SafeChannelUtils'
import FactoryContractInteractor from 'safechannels-contracts/src/js/FactoryContractInteractor'

import SimpleWalletApi from '../api/SimpleWallet.api'
import DelayedTransfer from '../etc/DelayedTransfer'
import DelayedContractCall from '../etc/DelayedContractCall'
import DelayedConfigChange from '../etc/DelayedConfigChange'
import ConfigEntry from '../etc/ConfigEntry'
import { changeTypeToString } from '../etc/ChangeType'
import { nonNull } from '../utils/utils'

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

function hash (participant) {
  return '0x' + SafeChannelUtils.participantHash(participant.address, participant.permLevel).toString('hex')
}

export default class SimpleWallet extends SimpleWalletApi {
  /**
   *
   * @param contract - TruffleContract instance of the Gatekeeper
   * @param participant - the participant to be used as the 'from' of all operations
   * @param backend - implementation of {@link ClientBackend}
   * @param whitelistFactory - instance ow Truffle Contract for whitelist deployment
   * @param knownParticipants - all other possible participants known to the wallet. Not necessarily activated on vault.
   *        Note: participants should be of 'Participant' class!
   * @param knownTokens - tokens currently supported.
   */
  constructor ({
    contract,
    participant,
    backend,
    whitelistFactory,
    knownParticipants = [],
    knownTokens = []
  }) {
    super()
    nonNull({ contract, participant })
    this.contract = contract
    this.backend = backend
    this.participant = participant
    this.whitelistFactory = whitelistFactory
    this.knownTokens = knownTokens
    this.knownParticipants = [...knownParticipants, participant]
    abiDecoder.addABI(FactoryContractInteractor.getErc20ABI())
    // TODO: make sure no duplicates
  }

  async initialConfiguration (configuration) {
    return this.contract.initialConfig(
      configuration.initialParticipants,
      configuration.initialDelays,
      configuration.allowAcceleratedCalls,
      configuration.allowAddOperatorNow,
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
      whitelisted = await this._isDestinationWhitelisted({ target: destination, value: amount, encodedFunction: '0x' })
      destinationAddress = destination
      ethAmount = amount
      encodedTransaction = []
    } else {
      destinationAddress = this._getTokenAddress(token)
      ethAmount = 0
      encodedTransaction = FactoryContractInteractor.encodeErc20Call({ destination, amount, operation: 'transfer' })
      whitelisted = await this._isDestinationWhitelisted({
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
        topic: delayedOpId,
        fromBlock: this.deployedBlock,
        toBlock: 'latest'
      }
    )
    if (pending.length === 0) {
      isConfig = false
      pending = await this.contract.getPastEvents('BypassCallPending',
        {
          topic: delayedOpId,
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

  // TODO: currently only initialConfig is checked. Must iterate over all config events to figure out the actual info.
  // TODO: split into two: scan events and interpret events.
  // TODO: add some caching mechanism then to avoid re-scanning entire history on every call
  async getWalletInfo () {
    this.stateId = await this.contract.stateNonce()
    const { allowAcceleratedCalls, allowAddOperatorNow } = await this._getAllowedFlags()
    console.log('address', this.contract.address)
    const { initEvent, participantAddedEvents } = await this._getCompletedConfigurationEvents()
    const args = initEvent.args
    const { foundParticipants, unknownParticipants } = this._findParticipants({ initEvent, participantAddedEvents })

    const participants = foundParticipants.map(it => {
      let type // TODO: move to participant class
      switch (it.permissions) {
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
        type: type,
        hash: hash(it)
      }
    })
    participants.push(...unknownParticipants.map(it => {
      return {
        address: 'n/a',
        level: 'n/a',
        type: 'n/a',
        hash: it
      }
    }))
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
        allowAcceleratedCalls,
        allowAddOperatorNow
      },
      participants,
      levels: levels
    }
  }

  /**
   *  TODO: add support for removing participant
   *  TODO: add support for unknown participants
   */
  _findParticipants ({ initEvent, participantAddedEvents }) {
    const participants = initEvent.args.participants
    participantAddedEvents.forEach(event => {
      participants.push(event.args.participant)
    })
    // This is ok, we will never have > 10 participants.
    const foundParticipants = this.knownParticipants.filter((it) => {
      return participants.includes(hash(it))
    })
    const unknownParticipants = participants.filter(it => {
      return !foundParticipants.map(it => hash(it)).includes(it)
    })
    return { foundParticipants, unknownParticipants }
  }

  async _getAllowedFlags () {
    const allowAcceleratedCalls = await this.contract.allowAcceleratedCalls()
    const allowAddOperatorNow = await this.contract.allowAddOperatorNow()
    return { allowAcceleratedCalls, allowAddOperatorNow }
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
    const web3 = new Web3(provider)
    return { provider, web3 }
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
    const bypassCalls = pastTransactionEvents.pendingEvents
      .filter(it => {
        return activeBypassPolicies.includes(it.args.target)
      })
      .map((it) => {
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
          dueTime: 0, // TODO: pendingChange.dueTime.toNumber(),
          state: 'mined',
          operations: operations
        })
      })
    const pastConfigEvents = await this._getPastEvents({ type: 'config' })
    const configChanges = pastConfigEvents.pendingEvents
      .map((it) => {
        const operations = []
        const common = {
          txHash: it.transactionHash,
          delayedOpId: it.args.delayedOpId,
          dueTime: 0, // TODO: fix events!
          state: 'mined'
        }
        for (let i = 0; i < it.args.actions.length; i++) {
          const type = changeTypeToString(it.args.actions[i])
          let args = [it.args.actionsArguments1[i], it.args.actionsArguments2[i]]
          // TODO: parse all args types to human-readable format
          // This is a hack to make one specific test pass. Will be fixed as more tests are added
          if (type === 'add_operator_now') {
            const participantToAdd = this.knownParticipants.filter((it) => {
              const hash = '0x' + SafeChannelUtils.participantHash(it.address, it.permLevel).toString('hex')
              return args[0] === hash
            })
            if (participantToAdd.length > 0) {
              args = [participantToAdd[0].address]
            }
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
    return allPendingTransactions
      .filter(it => {
        return !activeBypassPolicies.includes(it.args.target)
      })
      .map(
        (it) => {
          const isEtherValuePassed = it.args.value.toString() !== '0'
          const isDataPassed = it.args.msgdata && it.args.msgdata.length > 0
          const isErc20Method = isDataPassed && erc20Methods.includes(it.args.msgdata.substr(0, 10))
          // TODO: get all data from events, save roundtrips here
          const common = {
            txHash: it.transactionHash,
            delayedOpId: it.args.delayedOpId,
            dueTime: parseInt(it.args.dueTime, 16),
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
    const pendingEvents = scheduledEvents
      .filter(it => {
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

  static getDefaultSampleInitialConfiguration ({ backendAddress, operatorAddress, whitelistModuleAddress, whitelistedEthDestinations = [] }) {
    const backendAsWatchdog = '0x' +
      SafeChannelUtils.participantHashUnpacked(backendAddress, Permissions.WatchdogPermissions, 1).toString('hex')
    const backendAsAdmin = '0x' +
      SafeChannelUtils.participantHashUnpacked(backendAddress, Permissions.AdminPermissions, 1).toString('hex')
    const operator = '0x' +
      SafeChannelUtils.participantHashUnpacked(operatorAddress, Permissions.OwnerPermissions, 1).toString('hex')
    const bypassModules = []
    // This looks dumb, but I need the same module for each destination and each erc20 method
    for (let i = 0; i < whitelistedEthDestinations.length + 2; i++) {
      bypassModules.push(whitelistModuleAddress)
    }
    return {
      initialParticipants: [operator, backendAsWatchdog, backendAsAdmin],
      initialDelays: [86400, 172800],
      allowAcceleratedCalls: true,
      allowAddOperatorNow: true,
      requiredApprovalsPerLevel: [1, 0],
      bypassTargets: whitelistedEthDestinations,
      bypassMethods: ['0xa9059cbb', '0x095ea7b3'],
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

  async _isDestinationWhitelisted ({ target, value, encodedFunction }) {
    let moduleAddress = await this.contract.bypassPoliciesByTarget(target)
    if (moduleAddress === '0x0000000000000000000000000000000000000000') {
      if (encodedFunction.length < 10) {
        return false
      } else {
        const method = encodedFunction.substr(0, 10)
        moduleAddress = await this.contract.bypassPoliciesByMethod(method)
      }
    }
    const { provider } = this._getWeb3()
    const module = await FactoryContractInteractor.whitelistAt({ address: moduleAddress, provider })
    const policy = await module.getBypassPolicy(target, value, encodedFunction)
    return policy[0].toString() === '0' && policy[1].toString() === '0'
  }
}

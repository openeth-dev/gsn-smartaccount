import Permissions from 'safechannels-contracts/src/js/Permissions'
import SafeChannelUtils from 'safechannels-contracts/src/js/SafeChannelUtils'
import FactoryContractInteractor from 'safechannels-contracts/src/js/FactoryContractInteractor'

import SimpleWalletApi from '../api/SimpleWallet.api'
import DelayedTransfer from '../etc/DelayedTransfer'
import DelayedContractCall from '../etc/DelayedContractCall'

const erc20Methods = ['0xa9059cbb', '0x095ea7b3']

export default class SimpleWallet extends SimpleWalletApi {
  /**
   *
   * @param contract - TruffleContract instance of the Gatekeeper
   * @param participant - the participant to be used as the 'from' of all operations
   * @param knownParticipants - all other possible participants known to the wallet. Not necessarily activated on vault.
   * Note: participants should be of 'Participant' class!
   */
  constructor ({ contract, participant, knownParticipants }) {
    super()
    this.contract = contract
    this.participant = participant
    this.knownParticipants = knownParticipants
    this.knownParticipants.push(participant)
    // TODO: make sure no duplicates
  }

  async initialConfiguration (configuration) {
    await this.contract.initialConfig(
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
        gasPrice: 10
      }
    )
  }

  async transfer ({ destination, amount, token }) {
    let destinationAddress
    let ethAmount
    let encodedTransaction
    if (token === 'ETH') {
      destinationAddress = destination
      ethAmount = amount
      encodedTransaction = []
    } else {
      destinationAddress = this._getTokenAddress(token)
      ethAmount = 0
      encodedTransaction = FactoryContractInteractor.encodeErc20Call({ destination, amount, operation: 'transfer' })
    }
    await this.contract.scheduleBypassCall(
      this.participant.permLevel, destinationAddress, ethAmount, encodedTransaction, this.stateId,
      {
        from: this.participant.address
      })
  }

  removeOperator (addr) {
  }

  cancelPending (id) {
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
    const allowAcceleratedCalls = await this.contract.allowAcceleratedCalls()
    const allowAddOperatorNow = await this.contract.allowAddOperatorNow()
    const deployedBlock = await this._getDeployedBlock()
    const initEvent = (await this.contract.getPastEvents('SmartAccountInitialized', { fromBlock: 1, toBlock: 'latest' }))[0]
    const args = initEvent.args
    const foundParticipants = this.knownParticipants.filter((it) => {
      const hash = '0x' + SafeChannelUtils.participantHash(it.address, it.permLevel).toString('hex')
      return args.participants.includes(hash)
    })
    const operators = foundParticipants
      .filter(it => it.permissions === Permissions.OwnerPermissions)
      .map(it => {
        return it.address
      })

    const guardians = foundParticipants.filter(it => it.permissions !== Permissions.OwnerPermissions)
      .map(it => {
        let type // TODO: move to participant class
        switch (it.permissions) {
          case Permissions.WatchdogPermissions:
            type = 'watchdog'
            break
          case Permissions.AdminPermissions:
            type = 'admin'
            break
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
        requiredApprovals: args.requiredApprovalsPerLevel[i].toNumber()
      }
    }
    const unknownParticipantsCount = args.participants.length - foundParticipants.length
    return {
      address: initEvent.address,
      options: {
        allowAcceleratedCalls,
        allowAddOperatorNow
      },
      operators: operators,
      guardians: guardians,
      unknownGuardians: unknownParticipantsCount,
      levels: levels
    }
  }

  listTokens () {
  }

  async _getDeployedBlock () {
    if (!this.deployedBlock) {
      this.deployedBlock = (await this.contract.deployedBlock()).toNumber()
    }
    return this.deployedBlock
  }

  async listPendingConfigChanges () {

  }

  async listPendingTransactions () {
    const blocks = { fromBlock: (await this._getDeployedBlock()), toBlock: 'latest' }
    const { scheduledEvents, completedEvents, cancelledEvents } = await this._getPastOperationsEvents(blocks)
    const completedEventsHashes = completedEvents.map(it => it.args.bypassHash)
    const cancelledEventsHashes = cancelledEvents.map(it => it.args.bypassHash)
    const activeBypassPolicies = await this.listBypassPolicies()
    const promisesOfOperations = scheduledEvents
      .filter(it => {
        return !completedEventsHashes.includes(it.args.bypassHash) &&
          !cancelledEventsHashes.includes(it.args.bypassHash)
      })
      .filter(it => {
        return !activeBypassPolicies.includes(it.args.target)
      })
      .map(async (it) => {
        const isEtherValuePassed = it.value !== 0
        const isDataPassed = it.args.data !== undefined && it.args.data.length > 0
        const isErc20Method = isDataPassed && erc20Methods.includes(it.args.data.substr(0, 10))
        // TODO: get all data from events, save roundtrips here
        const pendingChange = await this.contract.getPendingChange(it.args.bypassHash)
        const common = {
          txHash: it.transactionHash,
          delayedOpId: it.args.bypassHash,
          dueTime: pendingChange.dueTime.toNumber(),
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
            data: it.args.data
          })
        }
      }
      )
    return Promise.all(promisesOfOperations)
  }

  async _getPastOperationsEvents ({ fromBlock, toBlock }) {
    const scheduledEvents = await this.contract.getPastEvents('BypassCallPending', { fromBlock, toBlock })
    const completedEvents = await this.contract.getPastEvents('BypassCallCancelled', { fromBlock, toBlock })
    const cancelledEvents = await this.contract.getPastEvents('BypassCallApplied', { fromBlock, toBlock })
    return {
      scheduledEvents, completedEvents, cancelledEvents
    }
  }

  listBypassPolicies () {
    return []
  }

  static getDefaultSampleInitialConfiguration ({ backendAddress, operatorAddress, whitelistModuleAddress }) {
    const backendAsWatchdog = '0x' + SafeChannelUtils.participantHashUnpacked(backendAddress, Permissions.WatchdogPermissions, 1).toString('hex')
    const backendAsAdmin = '0x' + SafeChannelUtils.participantHashUnpacked(backendAddress, Permissions.AdminPermissions, 1).toString('hex')
    const operator = '0x' + SafeChannelUtils.participantHashUnpacked(operatorAddress, Permissions.OwnerPermissions, 1).toString('hex')
    return {
      initialParticipants: [operator, backendAsWatchdog, backendAsAdmin],
      initialDelays: [86400, 172800],
      _allowAcceleratedCalls: true,
      _allowAddOperatorNow: true,
      requiredApprovalsPerLevel: [0, 1],
      bypassTargets: [],
      bypassMethods: ['0xa9059cbb', '0x095ea7b3'],
      bypassModules: [whitelistModuleAddress, whitelistModuleAddress]
    }
  }

  _parseErc20Transaction () {
  }
  // _parseErc20Transaction ({ target, data }) {
  //   return { tokenSymbol, operation, value, destination }
  // }

  _getTokenAddress (token) {
    return undefined
  }
}

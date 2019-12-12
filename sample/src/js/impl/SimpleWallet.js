import Permissions from 'safechannels-contracts/src/js/Permissions'
import SafeChannelUtils from 'safechannels-contracts/src/js/SafeChannelUtils'

import SimpleWalletApi from '../api/SimpleWallet.api'

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

  transfer ({ destination, amount, token }) {
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
    const allowAcceleratedCalls = await this.contract.allowAcceleratedCalls()
    const allowAddOperatorNow = await this.contract.allowAddOperatorNow()
    const deployedBlock = await this._getDeployedBlock()
    const initEvent = (await this.contract.getPastEvents('SmartAccountInitialized', { fromBlock: deployedBlock }))[0]
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
    return scheduledEvents
      .filter(it => {
        return !completedEventsHashes.includes(it.args.bypassHash) &&
          !cancelledEventsHashes.includes(it.args.bypassHash)
      })
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
}

import Web3 from 'web3'
import crypto from 'crypto'
// import FactoryContractInteractor from 'safechannels-contracts/src/js/FactoryContractInteractor'
import { knownEvents } from './knownEvents'
import abiDecoder from 'abi-decoder'
import SmartAccountFactoryABI from 'safechannels-contracts/src/js/generated/SmartAccountFactory'
import SmartAccountABI from 'safechannels-contracts/src/js/generated/SmartAccount'

export class Watchdog {
  constructor ({ smsManager, keyManager, accountManager, smartAccountFactoryAddress, web3provider }) {
    Object.assign(this, {
      smsManager,
      keyManager,
      accountManager,
      smartAccountFactoryAddress,
      web3provider,
      web3: new Web3(web3provider),
      secretSMSCodeSeed: crypto.randomBytes(32)
    })
    abiDecoder.addABI(SmartAccountFactoryABI)
    abiDecoder.addABI(SmartAccountABI)
    this.lastScannedBlock = 0
    this.changesToApply = {}
  }

  async start () {
    // this.smartAccountFactoryInteractor = await FactoryContractInteractor.getInstance(
    //   { smartAccountFactoryAddress: this.smartAccountFactoryAddress, provider: this.web3provider })
    console.log('setting periodic task')
    this.task = await setInterval(this._worker, 100 * 2)
    // await this._worker()
  }

  async stop () {
    clearInterval(this.task)
  }

  async _worker () {
    // TODO fetch all relevant events from blockchain
    const options = {
      fromBlock: this.lastScannedBlock,
      toBlock: 'latest',
      topics: [knownEvents.map(event => {
        return this.web3.utils.sha3(event[0] + event[1])
      })]

    }
    const logs = await this.web3.eth.getPastLogs(options)
    const decodedLogs = abiDecoder.decodeLogs(logs).map(this._parseEvent)
    // .filter(dlog => !!this.accountManager.getAccountById({ accountId: dlog.args.smartAccountId }) ||
    //   !!this.accountManager.getAccountByAddress({ address: dlog.address }))

    // const pending = decodedLogs.filter(d => d && d.name.includes('Pending'))
    // const applied = decodedLogs.filter(d => d && d.name.includes('Applied'))
    // const cancelled = decodedLogs.filter(d => d && d.name.includes('Cancelled'))

    for (const dlog of decodedLogs) {
      switch (dlog.name) {
        case 'SmartAccountCreated':
          await this._handleSmartAccountCreatedEvent(dlog)
          break
        case 'BypassCallPending':
          await this._handleBypassCallPendingEvent(dlog)
          break
        case 'ConfigPending':
          await this._handleConfigPendingEvent(dlog)
          break
        case 'BypassCallCancelled':
          await this._handleBypassCallCancelledEvent(dlog)
          break
        case 'ConfigCancelled':
          await this._handleConfigCancelledEvent(dlog)
          break
        case 'ConfigApplied':
          await this._handleConfigAppliedEvent(dlog)
          break
        case 'BypassCallApplied':
          await this._handleBypassCallAppliedEvent(dlog)
          break
      }
    }
    await this._applyChanges()
    this.lastScannedBlock = logs[logs.length - 1].blockNumber
  }

  // event SmartAccountCreated(address sender, SmartAccount smartAccount, bytes32 smartAccountId);
  async _handleSmartAccountCreatedEvent (dlog) {
    const account = this.accountManager.getAccountById({ accountId: dlog.args.smartAccountId })
    if (!account) {
      return
    }
    account.address = dlog.args.address
    this.accountManager.putAccount({ account })
    console.log('account is', account)
  }

  // event ConfigPending(bytes32 indexed transactionHash, address sender, uint32 senderPermsLevel, address booster,
  // uint32 boosterPermsLevel, uint256 stateId, uint8[] actions, bytes32[] actionsArguments1, bytes32[] actionsArguments2);
  async _handleConfigPendingEvent (dlog) {
    const account = this.accountManager.getAccountByAddress({ address: dlog.address })
    if (!account) {
      return
    }
    await this.smsManager.sendSMS({ phoneNumber: account.phone, email: account.email })
    const dueTime = dlog.args.dueTime * 1000 // TODO add dueTime to event
    const changeHash = dlog.args.transactionHash
    this.changesToApply[changeHash] = { dueTime: dueTime, log: dlog }
  }

  async _handleBypassCallPendingEvent (dlog) {
    const account = this.accountManager.getAccountByAddress({ address: dlog.address })
    if (!account) {
      return
    }
    await this.smsManager.sendSMS({ phoneNumber: account.phone, email: account.email })
    const dueTime = dlog.args.dueTime * 1000 // TODO add dueTime to event
    const changeHash = dlog.args.bypassHash
    this.changesToApply[changeHash] = { dueTime: dueTime, log: dlog }
  }

  async _handleConfigCancelledEvent (dlog) {
    const account = this.accountManager.getAccountByAddress({ address: dlog.address })
    if (!account) {
      return
    }
    const changeHash = dlog.args.transactionHash
    delete this.changesToApply[changeHash]
  }

  async _handleBypassCallCancelledEvent (dlog) {
    const account = this.accountManager.getAccountByAddress({ address: dlog.address })
    if (!account) {
      return
    }
    const changeHash = dlog.args.bypassHash
    delete this.changesToApply[changeHash]
  }

  async _handleConfigAppliedEvent (dlog) {
    const account = this.accountManager.getAccountByAddress({ address: dlog.address })
    if (!account) {
      return
    }
    const changeHash = dlog.args.transactionHash
    delete this.changesToApply[changeHash]
  }

  async _handleBypassCallAppliedEvent (dlog) {
    const account = this.accountManager.getAccountByAddress({ address: dlog.address })
    if (!account) {
      return
    }
    const changeHash = dlog.args.bypassHash
    delete this.changesToApply[changeHash]
  }

  async _applyChanges () {
    for (const change of Object.keys(this.changesToApply)) {
      if (change.dueTime >= Date.now() / 1000) {
        // TODO apply pending change onchain
        // ...

        delete this.changesToApply[change]
      }
    }
  }

  async cancelChange ({ smsCode, change, address }) {
    const account = this.accountManager.getAccountByAddress({ address })
    if (this.smsManager.getSmsCode(
      { phoneNumber: account.phone, email: account.email, expectedSmsCode: smsCode }) === smsCode) {
      // TODO cancel pending change onchain
      delete this.changesToApply[change]
    }
  }

  _parseEvent (e) {
    if (!e || !e.events) {
      return 'not event: ' + e
    }
    return {
      name: e.name,
      address: e.address,
      args: e.events.reduce(function (map, obj) {
        map[obj.name] = obj.value
        return map
      }, {})
    }
  }
}

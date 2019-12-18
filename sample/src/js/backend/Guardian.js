import Web3 from 'web3'
import crypto from 'crypto'
// import FactoryContractInteractor from 'safechannels-contracts/src/js/FactoryContractInteractor'
import Permissions from 'safechannels-contracts/src/js/Permissions'
import scutils from 'safechannels-contracts/src/js/SafeChannelUtils'
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
    this.permsLevel = scutils.packPermissionLevel(Permissions.WatchdogPermissions, 1)
    this.smartAccountInteractor = new this.web3.eth.Contract(SmartAccountABI, '', { from: this.keyManager.Address() })
    this.lastScannedBlock = 0
    this.changesToApply = {}
  }

  async start () {
    // this.smartAccountFactoryInteractor = await FactoryContractInteractor.getInstance(
    //   { smartAccountFactoryAddress: this.smartAccountFactoryAddress, provider: this.web3provider })
    console.log('setting periodic task')
    this.task = await setInterval(this._worker, 100 * 2)
  }

  async stop () {
    clearInterval(this.task)
  }

  async _worker () {
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

    for (const dlog of decodedLogs) {
      switch (dlog.name) {
        case 'SmartAccountCreated':
          await this._handleSmartAccountCreatedEvent(dlog)
          break
        case 'ConfigPending':
        case 'BypassCallPending':
          await this._handlePendingEvent(dlog)
          break
        case 'ConfigCancelled':
        case 'BypassCallCancelled':
        case 'ConfigApplied':
        case 'BypassCallApplied':
          await this._handleCancelledOrAppliedEvent(dlog)
          break
      }
    }
    await this._applyChanges()
    this.lastScannedBlock = logs[logs.length - 1].blockNumber
  }

  async _handleSmartAccountCreatedEvent (dlog) {
    const account = this.accountManager.getAccountById({ accountId: dlog.args.smartAccountId })
    if (!account || this.smartAccountFactoryAddress !== dlog.address) {
      return
    }
    account.address = dlog.args.smartAccount
    this.accountManager.putAccount({ account })
  }

  async _handlePendingEvent (dlog) {
    const account = this.accountManager.getAccountByAddress({ address: dlog.address })
    if (!account) {
      return
    }
    await this.smsManager.sendSMS({ phoneNumber: account.phone, email: account.email })
    const dueTime = dlog.args.dueTime * 1000
    const delayedOpId = dlog.args.delayedOpId
    this.changesToApply[delayedOpId] = { dueTime: dueTime, log: dlog }
  }

  async _handleCancelledOrAppliedEvent (dlog) {
    const account = this.accountManager.getAccountByAddress({ address: dlog.address })
    if (!account) {
      return
    }
    const delayedOpId = dlog.args.delayedOpId
    delete this.changesToApply[delayedOpId]
  }

  async _applyChanges () {
    for (const delayedOpId of Object.keys(this.changesToApply)) {
      const change = this.changesToApply[delayedOpId]
      if (change.dueTime <= Date.now()) {
        await this._finalizeChange(delayedOpId, { apply: true })
      }
    }
  }

  async cancelChange ({ smsCode, delayedOpId, address }) {
    const account = this.accountManager.getAccountByAddress({ address })
    if (this.smsManager.getSmsCode(
      { phoneNumber: account.phone, email: account.email, expectedSmsCode: smsCode }) === smsCode) {
      return this._finalizeChange(delayedOpId, { cancel: true })
    }
  }

  async _finalizeChange (delayedOpId, { apply, cancel }) {
    if (!apply && !cancel) {
      throw new Error('Please specify apply/cancel')
    }
    const change = this.changesToApply[delayedOpId]
    let method
    let smartAccountMethod
    this.smartAccountInteractor.options.address = change.log.address
    // TODO we should refactor events and function args to match in naming, and just use '...Object.values(change.log.args)'
    if (change.log.name === 'BypassCallPending') {
      if (apply) {
        smartAccountMethod = this.smartAccountInteractor.methods.applyBypassCall
      } else if (cancel) {
        smartAccountMethod = this.smartAccountInteractor.methods.cancelBypassCall
      }
      method = smartAccountMethod(
        this.permsLevel,
        change.log.args.sender,
        change.log.args.senderPermsLevel,
        change.log.args.stateId,
        change.log.args.target,
        change.log.args.value,
        change.log.args.msgdata || Buffer.alloc(0)
      )
    } else if (change.log.name === 'ConfigPending') {
      if (apply) {
        smartAccountMethod = this.smartAccountInteractor.methods.applyConfig
      } else if (cancel) {
        smartAccountMethod = this.smartAccountInteractor.methods.cancelOperation
      }
      method = smartAccountMethod(
        this.permsLevel,
        change.log.args.actions,
        change.log.args.actionsArguments1,
        change.log.args.actionsArguments2,
        change.log.args.stateId,
        change.log.args.sender,
        change.log.args.senderPermsLevel,
        change.log.args.booster,
        change.log.args.boosterPermsLevel
      )
    } else {
      return
    }
    try {
      const receipt = await this._sendTransaction(method, change)
      delete this.changesToApply[delayedOpId]
      return receipt
    } catch (e) {
      console.log(change.log.name)
      console.log('wtf e is', e)
    }
  }

  async _sendTransaction (method, change) {
    const encodedCall = method.encodeABI()
    let gasPrice = await this.web3.eth.getGasPrice()
    gasPrice = parseInt(gasPrice)
    const gas = await method.estimateGas({ from: this.keyManager.Address() })
    const nonce = await this.web3.eth.getTransactionCount(this.keyManager.Address())
    const txToSign = {
      to: change.log.address,
      value: 0,
      gasPrice: gasPrice || 1e9,
      gas: gas,
      data: encodedCall ? Buffer.from(encodedCall.slice(2), 'hex') : Buffer.alloc(0),
      nonce
    }
    const signedTx = this.keyManager.signTransaction(txToSign)
    const receipt = await this.web3.eth.sendSignedTransaction(signedTx)
    console.log('txhash is', receipt.transactionHash)
    return receipt
  }

  _parseEvent (e) {
    if (!e || !e.events) {
      return 'not event: ' + e
    }
    const args = {}
    for (const ee of e.events) {
      args[ee.name] = ee.value
    }
    return {
      name: e.name,
      address: e.address,
      args: args
    }
  }
}

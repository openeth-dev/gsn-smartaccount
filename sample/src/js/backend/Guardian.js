import Web3 from 'web3'
import crypto from 'crypto'
import Permissions from 'safechannels-contracts/src/js/Permissions'
import scutils from 'safechannels-contracts/src/js/SafeChannelUtils'
import abiDecoder from 'abi-decoder'
import SmartAccountFactoryABI from 'safechannels-contracts/src/js/generated/SmartAccountFactory'
import SmartAccountABI from 'safechannels-contracts/src/js/generated/SmartAccount'
import { ChangeType } from '../etc/ChangeType'

// const Action = {
//   CANCEL: 1,
//   APPLY: 2,
//   APPROVE: 3
// }

export class Watchdog {
  constructor ({ smsManager, keyManager, accountManager, smartAccountFactoryAddress, sponsorAddress, web3provider }) {
    Object.assign(this, {
      smsManager,
      keyManager,
      accountManager,
      smartAccountFactoryAddress,
      sponsorAddress,
      web3provider,
      web3: new Web3(web3provider),
      secretSMSCodeSeed: crypto.randomBytes(32)
    })
    abiDecoder.addABI(SmartAccountFactoryABI)
    abiDecoder.addABI(SmartAccountABI)
    this.permsLevel = scutils.packPermissionLevel(Permissions.WatchdogPermissions, 1)
    this.address = keyManager.address()
    this.smartAccountContract = new this.web3.eth.Contract(SmartAccountABI, '')
    this.smartAccountFactoryContract = new this.web3.eth.Contract(SmartAccountFactoryABI, smartAccountFactoryAddress)
    const smartAccountTopics = Object.keys(this.smartAccountContract.events).filter(x => (x.includes('0x')))
    const smartAccountFactoryTopics = Object.keys(this.smartAccountFactoryContract.events).filter(
      x => (x.includes('0x')))
    this.topics = smartAccountTopics.concat(smartAccountFactoryTopics)
    this.lastScannedBlock = 0
    this.changesToApply = {}
  }

  async start () {
    console.log('Subscribing to new blocks')
    this.subscription = this.web3.eth.subscribe('newBlockHeaders', function (error, result) {
      if (error) {
        console.error(error)
      }
    }).on('data', this._worker.bind(this)).on('error', console.error)
  }

  async stop () {
    this.subscription.unsubscribe(function (error, success) {
      if (success) {
        console.log('Successfully unsubscribed!')
      } else if (error) {
        throw error
      }
    })
  }

  async _worker (blockHeader) {
    const options = {
      fromBlock: this.lastScannedBlock + 1,
      toBlock: 'latest',
      topics: [this.topics]
    }
    const logs = await this.web3.eth.getPastLogs(options)
    const decodedLogs = abiDecoder.decodeLogs(logs).map(this._parseEvent)

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
    const txhashes = await this._applyChanges()
    if (logs[0] && logs[0].blockNumber) {
      this.lastScannedBlock = logs[logs.length - 1].blockNumber
    }
    return txhashes
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
    let dueTime
    if (dlog.name === 'ConfigPending' && dlog.args.actions[0] === ChangeType.ADD_OPERATOR_NOW.toString()) {
      dueTime = Date.now()
    } else {
      const smsCode = this.smsManager.getSmsCode({ phoneNumber: account.phone, email: account.email })
      await this.smsManager.sendSMS({
        phoneNumber: account.phone,
        message: `To cancel event ${dlog.args.delayedOpId} on smartAccount ${account.address}, enter code ${smsCode}`
      })
      dueTime = dlog.args.dueTime * 1000
    }
    this.changesToApply[dlog.args.delayedOpId] = { dueTime: dueTime, log: dlog }
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
    const txhashes = []
    for (const delayedOpId of Object.keys(this.changesToApply)) {
      const change = this.changesToApply[delayedOpId]
      if (change.dueTime <= Date.now()) {
        txhashes.push(await this._finalizeChange(delayedOpId, { apply: true }))
      }
    }
    return txhashes
  }

  static _extractCancelParamsFromUrl ({ url }) {
    const regex = /To cancel event (0x[0-9a-fA-F]*) on smartAccount (0x[0-9a-fA-F]*), enter code ([0-9]*)/
    const [, delayedOpId, address, smsCode] = url.match(regex)
    return { delayedOpId, address, smsCode }
  }

  // TODO check jwt? not sure if needed ATM
  async cancelByUrl ({ jwt, url }) {
    const { delayedOpId, address, smsCode } = Watchdog._extractCancelParamsFromUrl({ url })
    const account = this.accountManager.getAccountByAddress({ address })
    if (!account) {
      throw new Error(
        'Unknown account: either the account was not created on the backend or no address found from smartAccountCreated event')
    }
    if (this.smsManager.getSmsCode(
      { phoneNumber: account.phone, email: account.email, expectedSmsCode: smsCode }) === smsCode) {
      return { transactionHash: (await this._finalizeChange(delayedOpId, { cancel: true })).transactionHash }
    }
  }

  async _finalizeChange (delayedOpId, { apply, cancel }) {
    if (!apply && !cancel) {
      throw new Error('Please specify apply/cancel')
    }
    const change = this.changesToApply[delayedOpId]
    let method
    let smartAccountMethod
    this.smartAccountContract.options.address = change.log.address
    // TODO we should refactor events and function args to match in naming, and just use '...Object.values(change.log.args)'
    if (change.log.name === 'BypassCallPending') {
      if (apply) {
        smartAccountMethod = this.smartAccountContract.methods.applyBypassCall
      } else if (cancel) {
        smartAccountMethod = this.smartAccountContract.methods.cancelBypassCall
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
      if (change.log.args.actions.length === 1 && change.log.args.actions[0] === ChangeType.ADD_OPERATOR_NOW.toString()) {
        const account = this.accountManager.getAccountByAddress({ address: change.log.address })
        const newOperatorAddress = this.accountManager.getOperatorToAdd(
          { accountId: account.accountId })
        if (!newOperatorAddress) {
          // TODO cancel operation
          delete this.changesToApply[delayedOpId]
          return new Error(`Cannot find new operator address of accountId ${account.accountId}`)
        }
        const operatorHash = scutils.bufferToHex(scutils.operatorHash(newOperatorAddress))
        if (change.log.args.actionsArguments1[0] !== operatorHash) {
          // TODO cancel operation
          delete this.changesToApply[delayedOpId]
          return new Error(
            `participant hash mismatch:\nlog ${change.log.args.actionsArguments1[0]}\nexpected operator hash ${operatorHash}`)
        }
        this.accountManager.removeOperatorToAdd({ accountId: account.accountId })
        smartAccountMethod = this.smartAccountContract.methods.approveAddOperatorNow
        method = smartAccountMethod(
          this.permsLevel,
          newOperatorAddress,
          change.log.args.stateId,
          change.log.args.sender,
          change.log.args.senderPermsLevel
        )
      } else {
        if (apply) {
          smartAccountMethod = this.smartAccountContract.methods.applyConfig
        } else if (cancel) {
          smartAccountMethod = this.smartAccountContract.methods.cancelOperation
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
      }
    } else {
      delete this.changesToApply[delayedOpId]
      return new Error('Unsupported event' + change.log.name)
    }
    try {
      const receipt = await this._sendTransaction(method, change.log.address)
      delete this.changesToApply[delayedOpId]
      return receipt
    } catch (e) {
      return new Error(
        `Got error handling event ${e.message}\nevent ${change.log.name} ${JSON.stringify(change.log.args)}`)
    }
  }

  async _sendTransaction (method, destination) {
    const encodedCall = method.encodeABI()
    let gasPrice = await this.web3.eth.getGasPrice()
    gasPrice = parseInt(gasPrice)
    const gas = await method.estimateGas({ from: this.keyManager.address() })
    const nonce = await this.web3.eth.getTransactionCount(this.keyManager.address())
    const txToSign = {
      to: destination,
      value: 0,
      gasPrice: gasPrice || 1e9,
      gas: gas,
      data: encodedCall ? Buffer.from(encodedCall.slice(2), 'hex') : Buffer.alloc(0),
      nonce
    }
    const signedTx = this.keyManager.signTransaction(txToSign)
    const receipt = await this.web3.eth.sendSignedTransaction(signedTx)
    console.log('\ntxhash is', receipt.transactionHash)
    return receipt
  }

  _parseEvent (event) {
    if (!event || !event.events) {
      return 'not event: ' + event
    }
    const args = {}
    // event arguments is for some weird reason give as ".events"
    for (const eventArgument of event.events) {
      args[eventArgument.name] = eventArgument.value
    }
    return {
      name: event.name,
      address: event.address,
      args: args
    }
  }

  async getAddresses () {
    return {
      watchdog: this.keyManager.address(),
      admin: this.keyManager.address(),
      factory: this.smartAccountFactoryAddress,
      sponsor: this.sponsorAddress
    }
  }

  async scheduleAddOperator ({ accountId, newOperatorAddress }) {
    const account = this.accountManager.getAccountById({ accountId })
    if (!account) {
      throw Error('Account not found')
    }
    if (!account.address) {
      throw Error('Account address is notset yet')
    }
    this.smartAccountContract.options.address = account.address
    const stateId = await this.smartAccountContract.methods.stateNonce().call()
    const method = this.smartAccountContract.methods.scheduleAddOperator(
      // TODO: use permission selection logic!!!
      scutils.packPermissionLevel(Permissions.AdminPermissions, 1),
      newOperatorAddress,
      stateId)

    const txReceipt = await this._sendTransaction(method, account.address)
    return abiDecoder.decodeLogs(txReceipt.logs)
  }
}

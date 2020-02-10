import Web3 from 'web3'
import crypto from 'crypto'
import Permissions from 'safechannels-contracts/src/js/Permissions'
import scutils from 'safechannels-contracts/src/js/SafeChannelUtils'
import abiDecoder from 'abi-decoder'
import SmartAccountFactoryABI from 'safechannels-contracts/src/js/generated/SmartAccountFactory'
import SmartAccountABI from 'safechannels-contracts/src/js/generated/SmartAccount'
import { ChangeType } from '../etc/ChangeType'
import { URL } from 'url'
import querystring from 'querystring'

abiDecoder.addABI(SmartAccountFactoryABI)
abiDecoder.addABI(SmartAccountABI)

class Guardian {
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
    this.address = keyManager.address()
    this.smartAccountContract = new this.web3.eth.Contract(SmartAccountABI, '')
    this.smartAccountFactoryContract = new this.web3.eth.Contract(SmartAccountFactoryABI, smartAccountFactoryAddress)
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
}

export class Watchdog extends Guardian {
  constructor ({ smsManager, keyManager, accountManager, smartAccountFactoryAddress, sponsorAddress, web3provider, urlPrefix, level }) {
    super({ smsManager, keyManager, accountManager, smartAccountFactoryAddress, sponsorAddress, web3provider })
    this.urlPrefix = new URL(urlPrefix)
    if (!this.urlPrefix.href) {
      throw new Error(`Invalid url: ${urlPrefix}`)
    }
    this.permsLevel = scutils.packPermissionLevel(Permissions.WatchdogPermissions, level)
    const smartAccountTopics = Object.keys(this.smartAccountContract.events).filter(x => (x.includes('0x')))
    const smartAccountFactoryTopics = Object.keys(this.smartAccountFactoryContract.events).filter(
      x => (x.includes('0x')))
    this.topics = smartAccountTopics.concat(smartAccountFactoryTopics)
    this.lastScannedBlock = 0
    this.changesToApply = {}
  }

  start () {
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
    const account = await this.accountManager.getAccountById({ accountId: dlog.args.smartAccountId })
    if (!account || this.smartAccountFactoryAddress !== dlog.address) {
      return
    }
    account.address = dlog.args.smartAccount
    await this.accountManager.putAccount({ account })
  }

  async _handlePendingEvent (dlog) {
    const account = await this.accountManager.getAccountByAddress({ address: dlog.address })
    if (!account) {
      return
    }
    let dueTime
    if (dlog.name === 'ConfigPending' && dlog.args.actions[0] === ChangeType.ADD_OPERATOR_NOW.toString()) {
      dueTime = Date.now()
    } else {
      dueTime = dlog.args.dueTime * 1000
    }
    this.changesToApply[dlog.args.delayedOpId] = { dueTime: dueTime, log: dlog }
  }

  async _handleCancelledOrAppliedEvent (dlog) {
    const account = await this.accountManager.getAccountByAddress({ address: dlog.address })
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
      } else if (!change.smsSent) {
        const account = await this.accountManager.getAccountByAddress({ address: change.log.address })
        const smsCode = this.smsManager.getSmsCode({ phoneNumber: account.phone, email: account.email })
        await this.smsManager.sendSMS({
          phoneNumber: account.phone,
          message: `${this.urlPrefix.href}&delayedOpId=${change.log.args.delayedOpId}&address=${account.address}&smsCode=${smsCode}`
        })
        change.smsSent = true
      }
    }
    return txhashes
  }

  static _extractCancelParamsFromUrl ({ url }) {
    try {
      const { delayedOpId, address, smsCode } = querystring.parse(url)
      return { delayedOpId, address, smsCode }
    } catch (e) {
      throw new Error(`Invalid url: ${url}`)
    }
  }

  // TODO check jwt? not sure if needed ATM
  async cancelByUrl ({ jwt, url }) {
    const { delayedOpId, address, smsCode } = Watchdog._extractCancelParamsFromUrl({ url })
    const account = await this.accountManager.getAccountByAddress({ address })
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
    this.smartAccountContract.options.address = change.log.address
    // TODO we should refactor events and function args to match in naming, and just use '...Object.values(change.log.args)'
    if (change.log.name === 'BypassCallPending') {
      method = this._formatBypassCallMethod({ args: change.log.args, apply, cancel })
    } else if (change.log.name === 'ConfigPending') {
      // In case this is actually an addOperatorNow request, which is handled differently
      if (change.log.args.actions.length === 1 && change.log.args.actions[0] === ChangeType.ADD_OPERATOR_NOW.toString()) {
        const account = await this.accountManager.getAccountByAddress({ address: change.log.address })
        const newOperatorAddress = await this.accountManager.getOperatorToAdd(
          { accountId: account.accountId })
        if (!newOperatorAddress) {
          // TODO cancel operation
          delete this.changesToApply[delayedOpId]
          return new Error(`Cannot find new operator address of accountId ${account.accountId}`)
        }
        const operatorHash = scutils.bufferToHex(scutils.encodeParticipant(
          { address: newOperatorAddress, permissions: Permissions.OwnerPermissions, level: 1 }))
        if (change.log.args.actionsArguments1[0] !== operatorHash) {
          // TODO cancel operation
          delete this.changesToApply[delayedOpId]
          return new Error(
            `participant hash mismatch:\nlog ${change.log.args.actionsArguments1[0]}\nexpected operator hash ${operatorHash}`)
        }
        await this.accountManager.removeOperatorToAdd({ accountId: account.accountId })
        method = this._formatApproveAddOperatorNowMethod({ args: change.log.args, newOperatorAddress })
      } else { // All other config changes that are not addOperatorNow are handled the same
        method = this._formatConfigMethod({ args: change.log.args, apply, cancel })
      }
    } else {
      delete this.changesToApply[delayedOpId]
      return new Error('Unsupported event' + change.log.name)
    }
    try {
      const receipt = await this._sendTransaction(method, change.log.address)
      console.log('change', change.log.args.delayedOpId, apply ? 'applied' : (cancel ? 'cancelled' : 'not handled'))
      delete this.changesToApply[delayedOpId]
      return receipt
    } catch (e) {
      return new Error(
        `Got error handling event ${e.message}\nevent ${change.log.name} ${JSON.stringify(change.log.args)}`)
    }
  }

  _formatBypassCallMethod ({ args, apply, cancel }) {
    let smartAccountMethod
    if (apply) {
      smartAccountMethod = this.smartAccountContract.methods.applyBypassCall
    } else if (cancel) {
      smartAccountMethod = this.smartAccountContract.methods.cancelBypassCall
    }
    return smartAccountMethod(
      this.permsLevel,
      args.sender,
      args.senderPermsLevel,
      args.stateId,
      args.target,
      args.value,
      args.msgdata || Buffer.alloc(0)
    )
  }

  _formatConfigMethod ({ args, apply, cancel }) {
    let smartAccountMethod
    if (apply) {
      smartAccountMethod = this.smartAccountContract.methods.applyConfig
    } else if (cancel) {
      smartAccountMethod = this.smartAccountContract.methods.cancelOperation
    }
    return smartAccountMethod(
      this.permsLevel,
      args.actions,
      args.actionsArguments1,
      args.actionsArguments2,
      args.stateId,
      args.sender,
      args.senderPermsLevel,
      args.booster,
      args.boosterPermsLevel
    )
  }

  _formatApproveAddOperatorNowMethod ({ args, newOperatorAddress }) {
    const smartAccountMethod = this.smartAccountContract.methods.approveAddOperatorNow
    return smartAccountMethod(
      this.permsLevel,
      newOperatorAddress,
      args.stateId,
      args.sender,
      args.senderPermsLevel
    )
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
}

export class Admin extends Guardian {
  constructor ({ smsManager, keyManager, accountManager, smartAccountFactoryAddress, sponsorAddress, web3provider }) {
    super({ smsManager, keyManager, accountManager, smartAccountFactoryAddress, sponsorAddress, web3provider })
    this.permsLevel = scutils.packPermissionLevel(Permissions.AdminPermissions, 1)
  }

  async scheduleAddOperator ({ accountId, newOperatorAddress }) {
    const account = await this.accountManager.getAccountById({ accountId })
    if (!account) {
      throw Error('Account not found')
    }
    if (!account.address) {
      throw Error('Account address is not set yet')
    }
    this.smartAccountContract.options.address = account.address
    const stateId = await this.smartAccountContract.methods.stateNonce().call()
    const method = this.smartAccountContract.methods.scheduleAddOperator(
      // TODO: use permission selection logic!!!
      this.permsLevel,
      newOperatorAddress,
      stateId)

    const receipt = await this._sendTransaction(method, account.address)
    return { transactionHash: receipt.transactionHash }
  }
}

export class AutoCancelWatchdog extends Watchdog {
  async _applyChanges () {
    const txhashes = []
    for (const delayedOpId of Object.keys(this.changesToApply)) {
      txhashes.push(await this._finalizeChange(delayedOpId, { cancel: true }))
      console.log(`delayedOpId ${delayedOpId} cancelled`)
    }
    return txhashes
  }
}

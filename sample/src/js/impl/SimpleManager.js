import TruffleContract from '@truffle/contract'
import SmartAccountFactoryABI from 'safechannels-contracts/src/js/generated/SmartAccountFactory'
import WhitelistFactoryABI from 'safechannels-contracts/src/js/generated/BypassModules/WhitelistFactory'
import FactoryContractInteractor from 'safechannels-contracts/src/js/FactoryContractInteractor'

import SimpleWallet from './SimpleWallet'
import SimpleManagerApi from '../api/SimpleManager.api.js'

import Participant from 'safechannels-contracts/src/js/Participant'
import Permissions from 'safechannels-contracts/src/js/Permissions'
import { hex2buf, nonNull } from '../utils/utils'
import Web3 from 'web3'

// API of the main factory object.
export default class SimpleManager extends SimpleManagerApi {
  constructor ({ accountApi, backend, guardianAddress, factoryConfig }) {
    super()
    nonNull({ accountApi, factoryConfig, backend })
    this.accountApi = accountApi
    this.backend = backend
    this.factoryConfig = this._validateConfig(factoryConfig)
    this.web3 = new Web3(this.factoryConfig.provider)
  }

  async _init () {
    if (!this.guardianAddress) {
      const { watchdog } = (await this.backend.getAddresses())
      this.guardianAddress = watchdog
    }
  }

  async getEmail () {
    return this.accountApi.getEmail()
  }

  async googleLogin () {
    return this.accountApi.googleLogin()
  }

  async googleAuthenticate () {
    return this.accountApi.googleAuthenticate()
  }

  async signOut () {
    return this.accountApi.signOut()
  }

  async getOwner () {
    return this.accountApi.getOwner()
  }

  async validatePhone ({ jwt, phoneNumber }) {
    const response = await this.backend.validatePhone({ jwt, phoneNumber })
    if (response.code === 200) {
      return { success: true, reason: null }
    } else {
      return { success: false, reason: response.error }
    }
  }

  async getWalletAddress () {
    await this._initializeFactory(this.factoryConfig)

    const email = await this.getEmail()
    if (!email) { return null }

    const smartAccountId = await this.backend.getSmartAccountId({ email })
    const addr = await this.smartAccountFactory.knownSmartAccounts(hex2buf(smartAccountId))
    if (addr.match(/^0x0*$/)) { return null }
    return addr
  }

  async hasWallet () {
    return this.wallet != null
  }

  async recoverWallet ({ jwt, title }) {
    return this.backend.recoverWallet({ jwt, title })
  }

  async validateRecoverWallet ({ jwt, smsCode }) {
    return this.backend.validateRecoverWallet({ jwt, smsCode })
  }

  /**
   * Actual blockchain communication will be moved to the interaction layer later
   */
  async _initializeFactory ({ factoryAddress, whitelistFactoryAddress, provider }) {
    if (this.smartAccountFactory) {
      return
    }
    const SmartAccountFactoryContract = TruffleContract({
      contractName: 'SmartAccountFactory',
      abi: SmartAccountFactoryABI
    })
    SmartAccountFactoryContract.setProvider(provider)
    this.smartAccountFactory = await SmartAccountFactoryContract.at(factoryAddress)
    if (whitelistFactoryAddress) {
      const WhitelistFactoryContract = TruffleContract({
        contractName: 'WhitelistFactory',
        abi: WhitelistFactoryABI
      })
      WhitelistFactoryContract.setProvider(provider)
      this.whitelistFactory = await WhitelistFactoryContract.at(whitelistFactoryAddress)
    }
  }

  async createWallet ({ jwt, phoneNumber, smsVerificationCode }) {
    nonNull({ jwt, phoneNumber, smsVerificationCode })
    await this._initializeFactory(this.factoryConfig)

    const response = await this.backend.createAccount({
      jwt: jwt,
      phoneNumber: phoneNumber,
      smsCode: smsVerificationCode
    })

    const sender = await this.getOwner()
    // TODO: next commit: make 'FactoryContractInteractor.deployNewSmartAccount' do this job
    const smartAccountId = response.smartAccountId
    const approvalData = response.approvalData
    const res = await this.smartAccountFactory.newSmartAccount(smartAccountId, approvalData, {
      from: sender,
      gas: 1e8,
      approvalData: approvalData
    })
    if (!res.receipt.logs.length) {
      throw Error('New Smart Account seems to fail. Please verify.')
    }

    return this.loadWallet()
  }

  async loadWallet () {
    await this._init()

    const owner = await this.getOwner()
    const smartAccount = await this._getSmartAccountContract()

    const participants = this._getParticipants({ ownerAddress: owner, guardianAddress: this.guardianAddress })
    return new SimpleWallet({
      guardianAddress: this.guardianAddress,
      ownerAddress: owner,
      contract: smartAccount,
      backend: this.backend,
      whitelistFactory: this.whitelistFactory,
      participant: participants.operator,
      knownParticipants: [participants.backendAsAdmin, participants.backendAsWatchdog],
      knownTokens: this.factoryConfig.knownTokens
    })
  }

  async _getSmartAccountContract () {
    // TODO: read wallet with address, not from event!
    const address = await this.getWalletAddress()

    return FactoryContractInteractor.getCreatedSmartAccountAt({
      address,
      provider: this.factoryConfig.provider
    })
  }

  _getParticipants ({ ownerAddress, guardianAddress }) {
    return {
      operator: new Participant(ownerAddress, Permissions.OwnerPermissions, 1),
      backendAsWatchdog: new Participant(guardianAddress, Permissions.WatchdogPermissions, 1),
      backendAsAdmin: new Participant(guardianAddress, Permissions.AdminPermissions, 1)
    }
  }

  _validateConfig (factoryConfig) {
    // TODO: check all needed fields of config
    return factoryConfig
  }

  async addTimeLeft (pendings) {
    // TODO: can subscribe to newBlock, and make this method work without contacting the blockchain.
    const lastBlockTimestamp = (await this.web3.eth.getBlock('latest')).timestamp

    return pendings.map(p => ({
      ...p,
      timeLeft: p.dueTime - lastBlockTimestamp
    }))
  }

  async signInAsNewOperator ({ jwt, title, observer }) {
    if (observer) {
      await this.setSignInObserver({ observer, interval: 2000 })
    }
    return this.backend.signInAsNewOperator({ jwt, title })
  }

  // I could use the websocket provider, but it seems to be a little overkill for a single event
  async setSignInObserver ({ observer, interval }) {
    const self = this
    const block = await this.web3.eth.getBlock('latest')
    const fromBlock = block.number
    const handle = setInterval(getEvent, interval)
    const smartAccount = await this._getSmartAccountContract()

    async function getEvent () {
      console.log('getEvent')
      const participantAddedEvents = await smartAccount.getPastEvents('ParticipantAdded', {
        fromBlock,
        toBlock: 'latest'
      })
      if (participantAddedEvents.length) {
        clearInterval(handle)
        const wallet = await self.loadWallet()
        console.log('observer called')
        observer(wallet)
      }
    }
  }

  async cancelByUrl ({ jwt, url }) {
    return this.backend.cancelByUrl({ jwt, url })
  }
}

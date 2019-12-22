import TruffleContract from '@truffle/contract'
/* global error */
import SmartAccountFactoryABI from 'safechannels-contracts/src/js/generated/SmartAccountFactory'
import FactoryContractInteractor from 'safechannels-contracts/src/js/FactoryContractInteractor'

import SimpleWallet from './SimpleWallet'
import SimpleManagerApi from '../api/SimpleManager.api.js'

import Participant from 'safechannels-contracts/src/js/Participant'
import Permissions from 'safechannels-contracts/src/js/Permissions'

// API of the main factory object.
export default class SimpleManager extends SimpleManagerApi {
  constructor ({ accountApi, backend, guardianAddress, factoryConfig }) {
    super()
    this.accountApi = accountApi
    this.backend = backend
    this.guardianAddress = guardianAddress
    this.factoryConfig = this._validateConfig(factoryConfig)
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
    this.accountApi.signOut()
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
    const addr = await this.smartAccountFactory.knownSmartAccounts(smartAccountId)
    if (addr.match(/^0x0*$/)) { return null }
    return addr
  }

  async hasWallet () {
    return this.wallet != null
  }

  async recoverWallet ({ owner, email }) {
    error('trigger recover flow')
  }

  /**
   * Actual blockchain communication will be moved to the interaction layer later
   */
  async _initializeFactory ({ factoryAddress, provider }) {
    if (this.smartAccountFactory) {
      return
    }
    const SmartAccountFactoryContract = TruffleContract({
      contractName: 'SmartAccountFactory',
      abi: SmartAccountFactoryABI
    })
    SmartAccountFactoryContract.setProvider(provider)
    this.smartAccountFactory = await SmartAccountFactoryContract.at(factoryAddress)
  }

  async createWallet ({ jwt, phoneNumber, smsVerificationCode }) {
    if (!jwt || !phoneNumber || !smsVerificationCode) {
      throw Error('All parameters are required')
    }
    await this._initializeFactory(this.factoryConfig)

    const response = await this.backend.createAccount({
      jwt: jwt,
      phoneNumber: phoneNumber,
      smsCode: smsVerificationCode
    })

    const sender = await this.getOwner()
    // TODO: next commit: make 'FactoryContractInteractor.deployNewSmartAccount' do this job
    const smartAccountIdId = response.smartAccountId
    const approvalData = response.approvalData
    await this.smartAccountFactory.newSmartAccount(smartAccountIdId, {
      from: sender,
      gas: 1e8,
      approvalData: approvalData
    })

    return this.loadWallet()
  }

  async setInitialConfiguration () {
    const wallet = await this.loadWallet()
    const { watchdog } = (await this.backend.getAddresses())

    const config = SimpleWallet.getDefaultSampleInitialConfiguration({
      backendAddress: watchdog,
      operatorAddress: await this.getOwner(),
      whitelistModuleAddress: '0x' + '1'.repeat(40) // whitelistPolicy
    })
    await wallet.initialConfiguration(config)
  }

  async loadWallet () {
    const owner = await this.getOwner()
    // TODO: read wallet with address, not from event!
    const address = await this.getWalletAddress()

    console.log('load wallet address=', address)
    const smartAccount = await FactoryContractInteractor.getCreatedSmartAccountAt({
      address,
      provider: this.factoryConfig.provider
    })

    const participants = this._getParticipants({ ownerAddress: owner, guardianAddress: this.guardianAddress })
    return new SimpleWallet({
      contract: smartAccount,
      participant: participants.operator,
      knownParticipants: [participants.backendAsAdmin, participants.backendAsWatchdog]
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

  async signInAsNewOperator ({ jwt, description, observer }) {
    this.setSignInObserver({ observer, interval: 2000 })
    const response = await this.backend.signInAsNewOperator({ jwt, description })
    if (response.code === 200) {
      return { success: true, reason: null }
    } else {
      return { success: false, reason: response.error }
    }
  }

  setSignInObserver ({ observer, interval }) {
    setInterval(() => {
      console.log('how you gonna test?')
    }, interval)
  }
}

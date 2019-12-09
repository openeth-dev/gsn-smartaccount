import TruffleContract from '@truffle/contract'
/* global error */
import VaultFactoryABI from 'safechannels-contracts/src/js/generated/VaultFactory'
import FactoryContractInteractor from 'safechannels-contracts/src/js/FactoryContractInteractor'

import SimpleWallet from './SimpleWallet'
import SimpleManagerApi from '../api/SimpleManager.api.js'

// API of the main factory object.
export default class SimpleManager extends SimpleManagerApi {
  constructor ({ accountApi, backend, factoryConfig }) {
    super()
    this.accountApi = accountApi
    this.backend = backend
    this.factoryConfig = this._validateConfig(factoryConfig)
  }

  getEmail () {
    return this.accountApi.getEmail()
  }

  async googleLogin () {
    return this.accountApi.googleLogin()
  }

  async googleAuthenticate () {
    return this.accountApi.googleAuthenticate()
  }

  async signOut () {
    this.accountApi.signout()
  }

  getOwner () {
    return this.accountApi.getOwner()
  }

  async validatePhone ({ jwt, phone }) {
    const response = await this.backend.validatePhone({ jwt, phone })
    if (response.code === 200) {
      return { success: true, reason: null }
    } else {
      return { success: false, reason: response.error }
    }
  }

  async getWalletAddress () {
    if (await this.hasWallet()) {
      return this.wallet.address
    }

    return null
  }

  async hasWallet () {
    return this.wallet != null
  }

  async loadWallet () {
  }

  async recoverWallet ({ owner, email }) {
    error('trigger recover flow')
  }

  /**
   * Actual blockchain communication will be moved to the interaction layer later
   */
  async _initializeFactory ({ factoryAddress, provider }) {
    const VaultFactoryContract = TruffleContract({
      contractName: 'VaultFactory',
      abi: VaultFactoryABI
    })
    VaultFactoryContract.setProvider(provider)
    this.vaultFactory = await VaultFactoryContract.at(factoryAddress)
  }

  async createWallet ({ jwt, phone, smsVerificationCode }) {
    if (this.vaultFactory === undefined) {
      await this._initializeFactory(this.factoryConfig)
    }
    if (!jwt) {
      jwt = this.accountApi.googleAuthenticate().jwt
    }
    const response = await this.backend.createAccount({ jwt, smsVerificationCode })

    const sender = this.getOwner()
    // TODO: next commit: make 'FactoryContractInteractor.deployNewGatekeeper' do this job
    const receipt = await this.vaultFactory.newVault(response.vaultId, { from: sender, gas: 1e8 })
    const vault = await FactoryContractInteractor.getCreatedVault(
      {
        factoryAddress: this.factoryConfig.factoryAddress,
        sender: sender,
        blockNumber: receipt.blockNumber,
        provider: this.factoryConfig.provider
      })
    return new SimpleWallet({ contract: vault, participant: {}, knownParticipants: [] })
  }

  _validateConfig (factoryConfig) {
    // TODO: check all needed fields of config
    return factoryConfig
  }
}

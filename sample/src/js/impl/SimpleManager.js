import TruffleContract from '@truffle/contract'

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

  getOwner () {
    return {
      address: '0x90f8bf6a479f320ead074411a4b0e7944ea8c9c1',
      privateKey: '0x4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d'
    }
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
    if (this.hasWallet()) {
      return this.wallet.address
    }

    return null
  }

  hasWallet () {
    return this.wallet != null
  }

  loadWallet () {
  }

  recoverWallet (owner, account) {
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

  async createWallet ({ sms }) {
    if (this.vaultFactory === undefined) {
      await this._initializeFactory(this.factoryConfig)
    }
    const { jwt } = this.accountApi.googleAuthenticate()
    const response = await this.backend.createAccount({ jwt, sms })

    const sender = this.getOwner().address
    // TODO: next commit: make 'FactoryContractInteractor.deployNewGatekeeper' do this job
    const receipt = await this.vaultFactory.newVault(response.vaultId, { from: sender, gas: 1e8 })
    const vault = await FactoryContractInteractor.getCreatedVault(
      {
        factoryAddress: this.factoryConfig.factoryAddress,
        sender: sender,
        blockNumber: receipt.blockNumber,
        provider: this.factoryConfig.provider
      })
    return new SimpleWallet(vault)
  }

  _validateConfig () {
    // TODO: check all needed fields of config
  }
}

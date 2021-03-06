const TruffleContract = require('truffle-contract')
const fs = require('fs')
const Web3 = require('web3')
const zeroAddress = require('ethereumjs-util').zeroAddress

const Utils = require('./Utils')

const SmartAccountCreatedEvent = require('./events/SmartAccountCreatedEvent')
const FreeRecipientSponsorABI = require('./generated/tests/MockGsnForwarder')
const WhitelistBypassPolicyABI = require('./generated/BypassModules/WhitelistBypassPolicy')
const SmartAccountFactoryABI = require('./generated/SmartAccountFactory')
const SmartAccountABI = require('./generated/SmartAccount')
const ERC20ABI = require('./generated/tests/DAI')

const SmartAccountFactory = TruffleContract({
  contractName: 'SmartAccountFactory',
  abi: SmartAccountFactoryABI
})

const FreeRecipientSponsorContract = TruffleContract({
  contractName: 'FreeRecipientSponsorABI',
  abi: FreeRecipientSponsorABI
})

const ERC20Contract = TruffleContract({
  contractName: 'ERC20',
  abi: ERC20ABI
})

const WhitelistBypassPolicy = TruffleContract({
  contractName: 'WhitelistBypassPolicy',
  abi: WhitelistBypassPolicyABI
})

const smartAccountCreatedEvent = 'SmartAccountCreated'

class FactoryContractInteractor {
  // @deprecated
  constructor (credentials, smartAccountFactoryAddress) {
    this.credentials = credentials
    this.smartAccountFactoryAddress = smartAccountFactoryAddress
  }

  /**
   * Not a constructor because constructors cannot be async
   * @param credentials
   * @param smartAccountFactoryAddress
   * @param ethNodeUrl
   * @param networkId
   */
  // @deprecated
  static connect (credentials, smartAccountFactoryAddress, ethNodeUrl, networkId) {
    // Note to self: totally makes sense that this kind of code is only visible on the lowest, pure JS level
    // All the data needed to run this code should be passed as either strings or callbacks to the js-foundation
    const provider = new Web3.providers.HttpProvider(ethNodeUrl)

    SmartAccountFactory.setProvider(provider)
    return new FactoryContractInteractor(credentials, smartAccountFactoryAddress)
  }

  // @deprecated
  async attachToContracts () {
    if (this.smartAccountFactory) {
      return
    }
    if (!this.smartAccountFactoryAddress) {
      throw new Error('Smart Account Factory addresses is not set!')
    }
    this.smartAccountFactory = await SmartAccountFactory.at(this.smartAccountFactoryAddress)
  }

  static async deployContract (path, name, link, params, from, ethNodeUrl) {
    const abi = require('./' + path)
    // eslint-disable-next-line no-path-concat
    const bin = fs.readFileSync(__dirname + '/' + path + '.bin')
    const contract = TruffleContract({
      // NOTE: this string is later passed to a regex constructor when resolving, escape everything
      contractName: name,
      abi: abi,
      binary: bin
    })
    contract.setProvider(new Web3.providers.HttpProvider(ethNodeUrl))
    link.forEach(function (it) {
      contract.setNetwork(it.network_id)
      contract.link(it)
    })
    let promise
    const gas = undefined // truffle-contract does "autoGas" by default.
    // contract.gasMultiplier = 1.0 // default 1.25 is too much...
    if (params && params.length > 0) {
      promise = contract.new(...params, { from: from, gas: gas })
    } else {
      promise = contract.new({ from: from, gas: gas })
    }
    const instance = await promise
    contract.address = instance.address
    return { instance, contract }
  }

  static async deployERC20 (from, ethNodeUrl) {
    const { instance } = await this.deployContract(
      'generated/tests/DAI',
      'DAI',
      [], [], from, ethNodeUrl
    )
    return instance
  }

  static async deployMockHub (from, ethNodeUrl) {
    const { instance } = await this.deployContract(
      'generated/tests/MockHub',
      'MockHub',
      [], [], from, ethNodeUrl
    )
    return instance
  }

  static async deploySponsor (from, relayHub, ethNodeUrl) {
    const { instance } = await this.deployContract(
      'generated/tests/FreeRecipientSponsor',
      'FreeRecipientSponsor',
      [], [], from, ethNodeUrl
    )
    await instance.setRelayHub(relayHub, { from: from })
    return instance
  }

  static async deployNewMockForwarder (from, ethNodeUrl, hub) {
    const { instance } = await this.deployContract(
      'generated/tests/MockGsnForwarder',
      'MockGsnForwarder',
      [], [hub], from, ethNodeUrl
    )
    return instance
  }

  static async deploySmartAccountDirectly (from, relayHub, ethNodeUrl) {
    const utilitiesContract = await this.deployUtilitiesLibrary(from, ethNodeUrl)
    const { instance: bypassLib } = await this.deployContract(
      'generated/BypassModules/BypassLib',
      'bypassLib',
      [utilitiesContract], [], from, ethNodeUrl
    )
    const { instance: smartAccount } = await this.deployContract(
      'generated/SmartAccount',
      'SmartAccount',
      [utilitiesContract], [], from, ethNodeUrl
    )
    await smartAccount.ctr2(zeroAddress(), from, bypassLib.address, { from })
    return { smartAccount, bypassLib }
  }

  /**
   * Migrated this from test code to allow the Factory Interactor to deploy the Factory Contract.
   * This is mainly useful for tests, but anyways, JS-Foundation is the easiest place to put this code.
   * @returns {Promise<String>} - the address of the newly deployed Factory
   */
  static async deployNewSmartAccountFactory (from, ethNodeUrl, forwarder) {
    const utilitiesContract = await this.deployUtilitiesLibrary(from, ethNodeUrl)
    const { smartAccount: smartAccountTemplate, bypassLib } = await this.deploySmartAccountDirectly(from, ethNodeUrl)
    const { instance: smartAccountFactory } = await this.deployContract('generated/SmartAccountFactory',
      'SmartAccountFactory', [utilitiesContract], [forwarder, smartAccountTemplate.address, bypassLib.address], from,
      ethNodeUrl)
    return smartAccountFactory
  }

  static async deployNewWhitelistFactory (from, ethNodeUrl, forwarder) {
    const { instance: smartAccountFactory } = await this.deployContract('generated/BypassModules/WhitelistFactory',
      'WhitelistFactory', [], [forwarder], from, ethNodeUrl)
    return smartAccountFactory
  }

  // TODO: there is no reason anymore to depend on a library as instance. All methods must be 'inline'
  static async deployUtilitiesLibrary (from, ethNodeUrl) {
    const utilitiesLibraryPlaceholder = '\\$' + Web3.utils.keccak256('Utilities.sol:Utilities').substr(2, 34) + '\\$'
    const deployed = await this.deployContract(
      'generated/Utilities', utilitiesLibraryPlaceholder, [], [], from, ethNodeUrl)
    return deployed.contract
  }

  static linkEventsTopics (from, to) {
    Object.keys(from.events).forEach(function (topic) {
      to.network.events[topic] = from.events[topic]
    })
  }

  static async getGsnForwarder ({ address, provider }) {
    FreeRecipientSponsorContract.setProvider(provider)
    return FreeRecipientSponsorContract.at(address)
  }

  static async getErc20ContractAt ({ address, provider }) {
    ERC20Contract.setProvider(provider)
    return ERC20Contract.at(address)
  }

  static async whitelistAt ({ address, provider }) {
    WhitelistBypassPolicy.setProvider(provider)
    return WhitelistBypassPolicy.at(address)
  }

  static getErc20ABI () {
    return ERC20ABI
  }

  static encodeErc20Call ({ destination, amount, operation }) {
    return new (new Web3()).eth.Contract(ERC20ABI).methods.transfer(destination, amount).encodeABI()
  }

  static async getCreatedSmartAccountAt ({ address, provider }) {
    const SmartAccountContract = TruffleContract({
      contractName: 'SmartAccount',
      abi: SmartAccountABI
    })
    SmartAccountContract.setProvider(provider)
    return SmartAccountContract.at(address)
  }

  async deployNewSmartAccount () {
    await this.attachToContracts()
    // TODO: figure out what is wrong with 'estimate gas'.
    //  Works for Truffle test, fails in Mocha test, doesn't give a "out of gas" in console;
    const receipt = await this.smartAccountFactory.newSmartAccount({
      from: this.credentials.getAddress(),
      gas: 0x6691b7
    })
    return new SmartAccountCreatedEvent(receipt.logs[0])
  }

  async getSmartAccountCreatedEvent (options) {
    await this.attachToContracts()
    const events = await Utils.getEvents(this.smartAccountFactory, smartAccountCreatedEvent, options,
      SmartAccountCreatedEvent)
    if (events.length !== 1) {
      throw new Error('Invalid smart account created events array size')
    }
    return events[0]
  }
}

module.exports = FactoryContractInteractor

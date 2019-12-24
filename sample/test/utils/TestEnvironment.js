import { spawn } from 'child_process'
import Web3 from 'web3'
import FactoryContractInteractor from 'safechannels-contracts/src/js/FactoryContractInteractor'
import axios from 'axios'
import path from 'path'
import { MockStorage } from '../mocks/MockStorage'
import SmartAccountSDK from '../../src/js/impl/SmartAccountSDK'
import Account from '../../src/js/impl/Account'
import SimpleManager from '../../src/js/impl/SimpleManager'
import RelayServerMock from '../mocks/RelayServer.mock'
import ClientBackend from '../../src/js/backend/ClientBackend'

/**
 * AFAIK, the docker image will always deploy the hub to the same address
 * @type {string}
 */
const _relayHub = '0xD216153c06E857cD7f72665E0aF1d7D82172F494'
const _ethNodeUrl = 'http://localhost:8545'
const _relayUrl = 'http://localhost:8090'
const _serverUrl = 'http://localhost:8888/'
const verbose = false

export default class TestEnvironment {
  constructor ({
    ethNodeUrl = _ethNodeUrl,
    relayUrl = _relayUrl,
    serverUrl = _serverUrl,
    relayHub = _relayHub,
    clientBackend,
    web3provider
  }) {
    this.ethNodeUrl = ethNodeUrl
    this.relayUrl = relayUrl
    this.relayHub = relayHub
    this.clientBackend = clientBackend || new ClientBackend({ serverURL: serverUrl })
    this.web3provider = web3provider || new Web3.providers.HttpProvider(ethNodeUrl)
    this.web3 = new Web3(this.web3provider)
  }

  static async initializeWithFakeBackendAndGSN ({
    ethNodeUrl,
    relayUrl,
    relayHub,
    web3provider,
    clientBackend
  }) {
    const instance = new TestEnvironment({ ethNodeUrl, relayUrl, relayHub, web3provider, clientBackend })
    instance.from = (await instance.web3.eth.getAccounts())[0]
    instance.backendAddresses = await instance.clientBackend.getAddresses()
    await instance.deployMockHub()
    await instance.deployNewFactory()
    await instance.initializeSimpleManager()
    return instance
  }

  static async initializeAndStartBackendForRealGSN ({
    ethNodeUrl,
    relayUrl,
    relayHub,
    web3provider,
    clientBackend
  }) {
    const instance = new TestEnvironment({ ethNodeUrl, relayUrl, relayHub, web3provider, clientBackend })
    instance.from = (await instance.web3.eth.getAccounts())[0]
    await instance.fundRelayIfNeeded()
    await instance.deployNewFactory()
    await instance.startBackendServer()
    // From this point on, there is an external process running that has to be killed if construction fails
    try {
      instance.backendAddresses = await instance.clientBackend.getAddresses()
      await instance.addBackendAsTrustedSignerOnFactory()
      await instance.initializeSimpleManager()
      return instance
    } catch (e) {
      instance.stopBackendServer()
      throw e
    }
  }

  async startBackendServer () {
    const port = 8888
    return new Promise((resolve, reject) => {
      const runServerPath = path.resolve(__dirname, '../../../sample/src/js/backend/runServer.js')
      this.ls = spawn('node', [
        '-r',
        'esm',
        runServerPath,
        port,
        this.factory.address,
        this.sponsor.address,
        '--dev'
      ])
      let serverAddress
      this.ls.stdout.on('data', (data) => {
        process.stdout.write(`stdout: ${data}`)
        const m = data.toString().match(/address=(.*)/)
        if (m) { serverAddress = m[1] }
        if (data.includes('listening')) {
          resolve(serverAddress)
        }
      })
      this.ls.stderr.on('data', (data) => {
        console.error(`stderr: ${data}`)
      })
      this.ls.on('close', (code) => {
        console.log(`child process exited with code ${code}`)
        reject(Error('process quit'))
      })
    })
  }

  stopBackendServer () {
    this.ls.kill(9)
  }

  async deployNewFactory () {
    this.sponsor = await FactoryContractInteractor.deploySponsor(this.from, this.relayHub, this.ethNodeUrl)
    await this.sponsor.relayHubDeposit({ value: 2e18, from: this.from, gas: 1e5 })
    const forwarderAddress = await this.sponsor.getGsnForwarder()
    this.factory = await FactoryContractInteractor.deployNewSmartAccountFactory(this.from, this.ethNodeUrl, forwarderAddress)
  }

  async deployMockHub () {
    const mockHub = await FactoryContractInteractor.deployMockHub(this.from, this.ethNodeUrl)
    this.relayHub = mockHub.address
    this.mockHub = mockHub
    this.isRelayHubMocked = true
  }

  async addBackendAsTrustedSignerOnFactory () {
    await this.factory.addTrustedSigners([this.backendAddresses.watchdog], { from: this.from })
  }

  async getRelayAddress () {
    const res = await axios.get(this.relayUrl + '/getaddr')
    return res.data.RelayServerAddress
  }

  async fundRelayIfNeeded () {
    const relayAddr = await this.getRelayAddress()
    if (await this.web3.eth.getBalance(relayAddr) < 3e18) {
      await this.web3.eth.sendTransaction({ from: this.from, value: 3e18, to: relayAddr })
      console.log('funded relay')
    }
  }

  async initializeSimpleManager () {
    const relayOptions = {
      verbose,
      sponsor: this.sponsor.address
    }
    if (this.isRelayHubMocked) {
      relayOptions.httpSend = new RelayServerMock({
        mockHubContract: this.mockHub,
        relayServerAddress: this.from.toLowerCase(),
        web3provider: this.web3provider
      })
    }
    const storage = new MockStorage()
    const acc = await SmartAccountSDK.init({
      network: this.web3provider,
      account: new Account(storage), // override default proxy
      relayOptions
    })
    const factoryConfig = {
      provider: acc.provider,
      factoryAddress: this.factory.address
    }

    this.manager = new SimpleManager({
      accountApi: acc.account,
      backend: this.clientBackend,
      guardianAddress: this.backendAddresses.watchdog,
      factoryConfig
    })
  }
}

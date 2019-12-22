import { spawn } from 'child_process'
import Web3 from 'web3'
import FactoryContractInteractor from 'safechannels-contracts/src/js/FactoryContractInteractor'
import axios from 'axios'
import path from 'path'
import ClientBackend from '../../src/js/backend/ClientBackend'
import { MockStorage } from '../mocks/MockStorage'
import SmartAccountSDK from '../../src/js/impl/SmartAccountSDK'
import Account from '../../src/js/impl/Account'
import SimpleManager from '../../src/js/impl/SimpleManager'

/**
 * AFAIK, the docker image will always deploy the hub to the same address
 * @type {string}
 */
const relayHubAddress = '0xD216153c06E857cD7f72665E0aF1d7D82172F494'
// TODO: accept as constructor params
const ethNodeUrl = 'http://localhost:8545'
const relayUrl = 'http://localhost:8090'
const serverUrl = 'http://localhost:8888/'
const verbose = false

export default class TestEnvironment {
  constructor () {
    this.ethNodeUrl = ethNodeUrl
    this.relayUrl = relayUrl
    this.serverURL = serverUrl
    this.clientBackend = new ClientBackend({ serverURL: this.serverURL })
    this.web3provider = new Web3.providers.HttpProvider(this.ethNodeUrl)
    this.web3 = new Web3(this.web3provider)
  }

  async initialize () {
    this.from = (await this.web3.eth.getAccounts())[0]
    await this.getRelayAddress()
    await this.fundRelayIfNeeded()
    await this.deployNewFactory()
    await this.startBackendServer()
    this.backendAddresses = await this.clientBackend.getAddresses()
    await this.addBackendAsTrustedSignerOnFactory()
    await this.initializeSimpleManager()
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

  async stopBackendServer () {
    this.ls.kill(9)
  }

  async deployNewFactory () {
    this.sponsor = await FactoryContractInteractor.deploySponsor(this.from, relayHubAddress, this.ethNodeUrl)
    await this.sponsor.relayHubDeposit({ value: 2e18, from: this.from })
    const forwarderAddress = await this.sponsor.getGsnForwarder()
    this.factory = await FactoryContractInteractor.deployNewSmartAccountFactory(this.from, this.ethNodeUrl, forwarderAddress)
  }

  async addBackendAsTrustedSignerOnFactory () {
    await this.factory.addTrustedSigners([this.backendAddresses.watchdog], { from: this.from })
  }

  async getRelayAddress () {
    const res = await axios.get(this.relayUrl + '/getaddr')
    this.relayAddr = res.data.RelayServerAddress
  }

  async fundRelayIfNeeded () {
    if (await this.web3.eth.getBalance(this.relayAddr) < 3e18) {
      await this.web3.eth.sendTransaction({ from: this.from, value: 3e18, to: this.relayAddr })
      console.log('funded relay')
    }
  }

  async initializeSimpleManager () {
    const relayOptions = {
      verbose,
      sponsor: this.backendAddresses.sponsor
    }
    const storage = new MockStorage()
    const acc = await SmartAccountSDK.init({
      network: this.web3provider,
      account: new Account(storage), // override default proxy
      relayOptions
    })
    const factoryConfig = {
      provider: acc.provider,
      factoryAddress: this.backendAddresses.factory
    }

    this.manager = new SimpleManager({
      accountApi: acc.account,
      backend: this.clientBackend,
      guardianAddress: this.backendAddresses.guardianAddress,
      factoryConfig
    })
  }
}

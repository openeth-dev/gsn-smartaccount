/* global describe before after it */

// import { Account, Backend } from '../../src/js/backend/Backend'
// import { assert } from 'chai'
import Web3 from 'web3'
import SMSmock from '../../src/js/mocks/SMS.mock'
import { Watchdog } from '../../src/js/backend/Guardian'
import { KeyManager } from '../../src/js/backend/KeyManager'
import FactoryContractInteractor from 'safechannels-contracts/src/js/FactoryContractInteractor'
import { AccountManager } from '../../src/js/backend/AccountManager'

describe('As Guardian', async function () {
  const verbose = false
  let watchdog
  let smsProvider
  let mockhub
  let forward
  let factory
  let sponsor
  const keypair = {
    privateKey: Buffer.from('20e12d5dc484a03c969d48446d897a006ebef40a806dab16d58db79ba64aa01f', 'hex'),
    address: '0x68cc521201a7f8617c5ce373b0f0993ee665ef63'
  }
  let keyManager
  let accountManager
  const ethNodeUrl = 'http://localhost:8545'
  const from = '0x90f8bf6a479f320ead074411a4b0e7944ea8c9c1'
  let web3provider

  before(async function () {
    web3provider = new Web3.providers.HttpProvider(ethNodeUrl)
    mockhub = await FactoryContractInteractor.deployMockHub(from, ethNodeUrl)
    sponsor = await FactoryContractInteractor.deploySponsor(from, mockhub.address, ethNodeUrl)
    const forwarderAddress = await sponsor.contract.methods.getGsnForwarder().call()
    forward = await FactoryContractInteractor.getGsnForwarder({ address: forwarderAddress, provider: web3provider })
    factory = await FactoryContractInteractor.deployNewSmartAccountFactory(from, ethNodeUrl, forward.address)
    if (!verbose) {
      return
    }
    const spHub = await sponsor.contract.methods.getHubAddr().call()
    const fwHub = await forward.contract.methods.getHubAddr().call()
    const vfHub = await factory.contract.methods.getHubAddr().call()
    const vfFwd = await factory.contract.methods.getGsnForwarder().call()
    console.log(`spHub = ${spHub} fwHub=${fwHub} vfHub=${vfHub} vfFwd=${vfFwd}`)
    console.log(
      `mockhub = ${mockhub.address} factory=${factory.address} sponsor=${sponsor.address} forward=${forward.address}`)
  })

  describe('As Watchdog', async function () {
    before(async function () {
      web3provider = new Web3.providers.HttpProvider(ethNodeUrl)
    })

    it('should start Watchdog', async function () {
      this.timeout(1000 * 30)
      smsProvider = new SMSmock()
      keyManager = new KeyManager({ ecdsaKeyPair: keypair })
      accountManager = new AccountManager()
      watchdog = new Watchdog(
        { smsProvider, keyManager, accountManager, smartAccountFactoryAddress: factory.address, web3provider })

      // await watchdog.start()
      await watchdog._worker()
    })

    after(async function () {
      await watchdog.stop()
    })
  })

  describe('As Admin', async function () {
  })
})

/* global describe it before after */

import { assert, expect } from 'chai'
import { MockStorage } from '../mocks/MockStorage'
import SafeAccount from '../../src/js/impl/SafeAccount'
import Account from '../../src/js/impl/Account'
import SimpleManager from '../../src/js/impl/SimpleManager'
import ClientBackend from '../../src/js/backend/ClientBackend'
import Web3 from 'web3'
import FactoryContractInteractor from 'safechannels-contracts/src/js/FactoryContractInteractor'
import SMSmock from '../../src/js/mocks/SMS.mock'
import { startBackendServer, stopBackendServer } from '../utils/testBackendServer'

import axios from 'axios'
import SimpleWallet from '../../src/js/impl/SimpleWallet'

const relayHubAddress = '0xD216153c06E857cD7f72665E0aF1d7D82172F494'

const verbose = false

describe('SafeAccount flows', () => {
  const relayUrl = 'http://localhost:8090'
  let relayAddr

  before('check "gsn-dock-relay" is active', async function () {
    try {
      const res = await axios.get(relayUrl + '/getaddr')
      relayAddr = res.data.RelayServerAddress
    } catch (e) {
      console.warn('skipped flow test - no active "gsn-dock-relay"')
      this.skip()
    }
  })
  describe('create flow with account', async () => {
    const userEmail = 'user@email.com'
    let mgr
    let jwt, phoneNumber

    let backendAddress

    before('start backend', async () => {
      backendAddress = await startBackendServer({ port: 8887 })
      console.log('started server address: ', backendAddress)
    })

    after('stop backend', async () => {
      await stopBackendServer()
    })

    before('create manager', async () => {
      const ethNodeUrl = 'http://localhost:8545'
      const web3provider = new Web3.providers.HttpProvider(ethNodeUrl)
      const web3 = new Web3(web3provider)
      const accounts = await web3.eth.getAccounts()
      const from = accounts[0]

      const backend = new ClientBackend({ serverURL: 'http://localhost:8887/' })

      const sponsor = await FactoryContractInteractor.deploySponsor(from, relayHubAddress, ethNodeUrl)
      await sponsor.relayHubDeposit({ value: 2e18, from })
      await sponsor.relayHubDeposit({ value: 2e18, from })

      if (await web3.eth.getBalance(relayAddr) < 3e18) {
        await web3.eth.sendTransaction({ from, value: 3e18, to: relayAddr })
        console.log('funded relay')
      }

      const forwarderAddress = await sponsor.contract.methods.getGsnForwarder().call()
      const forward = await FactoryContractInteractor.getGsnForwarder({
        address: forwarderAddress,
        provider: web3provider
      })
      const factory = await FactoryContractInteractor.deployNewSmartAccountFactory(from, ethNodeUrl, forward.address)
      await factory.addTrustedSigners([backendAddress], { from })

      const relayOptions = {
        verbose,
        sponsor: sponsor.address
      }
      const storage = new MockStorage()
      const acc = await SafeAccount.init({
        network: web3provider,
        account: new Account(storage), // override default proxy
        relayOptions
      })

      const factoryConfig = {
        provider: acc.provider,
        factoryAddress: factory.address
      }

      mgr = new SimpleManager({
        accountApi: acc.account,
        backend,
        factoryConfig
      })

      // hack: to fill knownParticipants..
      mgr.backendAddress = backendAddress
    })

    it('new browser attempt login', async () => {
      assert.equal(await mgr.hasWallet(), false)
      assert.equal(await mgr.getOwner(), null)
      assert.equal(await mgr.getEmail(), null)
      assert.equal(await mgr.getWalletAddress(), null)

      // jwt is "opaque". we also get the plain values back.
      const { jwt: _jwt, email, address } = await mgr.googleLogin()
      jwt = _jwt

      expect(jwt).to.match(/\w+/) // just verify there's something..
      assert.equal(email, userEmail) // only in mock...
      assert.equal(email, await mgr.getEmail())
      assert.equal(address, await mgr.getOwner())
    })

    it('after user inputs phone', async () => {
      phoneNumber = '+972545655145' // user input

      await mgr.validatePhone({ jwt, phoneNumber })
    })

    it('after user receives SMS', async () => {
      const msg = await SMSmock.asyncReadSms()

      const smsVerificationCode = msg.message.match(/verif.*?(\d+)/)[1]

      wallet = await mgr.createWallet({ jwt, phoneNumber, smsVerificationCode })
    })

    let wallet

    it('initialConfiguration', async () => {
      const config = SimpleWallet.getDefaultSampleInitialConfiguration({
        backendAddress,
        operatorAddress: await mgr.getOwner(),
        whitelistModuleAddress: '0x' + '1'.repeat(40) // whitelistPolicy
      })
      await wallet.initialConfiguration(config)

      console.log('wallet=', await wallet.getWalletInfo())
    })

    it('after wallet creation', async function () {
      const wallet = await mgr.loadWallet()

      const info = await wallet.getWalletInfo()
      assert.deepEqual(info.operators, [await mgr.getOwner()])
      assert.equal(info.unknownGuardians, 0)
    })
  })
})

/* global describe it before after */

import { assert, expect } from 'chai'
import { MockStorage } from '../mocks/MockStorage'
import SmartAccountSDK from '../../src/js/impl/SmartAccountSDK'
import Account from '../../src/js/impl/Account'
import SimpleManager from '../../src/js/impl/SimpleManager'
import ClientBackend from '../../src/js/backend/ClientBackend'
import Web3 from 'web3'
import FactoryContractInteractor from 'safechannels-contracts/src/js/FactoryContractInteractor'
import SMSmock from '../../src/js/mocks/SMS.mock'
import { startBackendServer, stopBackendServer } from '../utils/testBackendServer'

import axios from 'axios'

const relayHubAddress = '0xD216153c06E857cD7f72665E0aF1d7D82172F494'

const verbose = false

describe('System flow: Create Account', () => {
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

    after('stop backend', async () => {
      await stopBackendServer()
    })

    const ethNodeUrl = 'http://localhost:8545'

    before('deploy contracts, start server', async () => {
      const web3provider = new Web3.providers.HttpProvider(ethNodeUrl)
      const web3 = new Web3(web3provider)
      const accounts = await web3.eth.getAccounts()
      const from = accounts[0]

      // servers, contract deployment:
      const sponsor = await FactoryContractInteractor.deploySponsor(from, relayHubAddress, ethNodeUrl)
      await sponsor.relayHubDeposit({ value: 2e18, from })

      if (await web3.eth.getBalance(relayAddr) < 3e18) {
        await web3.eth.sendTransaction({ from, value: 3e18, to: relayAddr })
        console.log('funded relay')
      }

      const forwarderAddress = await sponsor.getGsnForwarder()

      const forward = await FactoryContractInteractor.getGsnForwarder({
        address: forwarderAddress,
        provider: web3provider
      })

      const factory = await FactoryContractInteractor.deployNewSmartAccountFactory(from, ethNodeUrl, forward.address)

      await startBackendServer({
        port: 8887,
        factoryAddress: factory.address,
        sponsorAddress: sponsor.address
      })

      const { watchdog: backendAddress } = await new ClientBackend({ serverURL: 'http://localhost:8887/' }).getAddresses()

      await factory.addTrustedSigners([backendAddress], { from })
    })

    before('setup client', async () => {
      const web3provider = new Web3.providers.HttpProvider(ethNodeUrl)

      const backend = new ClientBackend({ serverURL: 'http://localhost:8887/' })

      const { sponsor, factory, watchdog: guardianAddress } = (await backend.getAddresses())

      const relayOptions = {
        verbose,
        sponsor
      }
      const storage = new MockStorage()
      const acc = await SmartAccountSDK.init({
        network: web3provider,
        account: new Account(storage), // override default proxy
        relayOptions
      })

      const factoryConfig = {
        provider: acc.provider,
        factoryAddress: factory
      }

      mgr = new SimpleManager({
        accountApi: acc.account,
        backend,
        guardianAddress,
        factoryConfig
      })
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
      phoneNumber = '+972541234567' // user input

      await mgr.validatePhone({ jwt, phoneNumber })
    })

    it('after user receives SMS', async () => {
      const msg = await SMSmock.asyncReadSms()

      const smsVerificationCode = msg.message.match(/verif.*?(\d+)/)[1]

      wallet = await mgr.createWallet({ jwt, phoneNumber, smsVerificationCode })

      assert.equal(await mgr.getWalletAddress(), wallet.contract.address)
    })

    let wallet

    it('initialConfiguration', async () => {
      await mgr.setInitialConfiguration()

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

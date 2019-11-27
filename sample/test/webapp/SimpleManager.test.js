/* eslint-disable no-unused-expressions */
/* global describe beforeEach before it */
import assert from 'assert'
import chai, { expect } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import sinon from 'sinon'
import Web3 from 'web3'
import Web3Utils from 'web3-utils'

import FactoryContractInteractor from 'safechannels-contracts/src/js/FactoryContractInteractor'

import { SponsorProvider } from 'gsn-sponsor'

import SimpleManager from '../../src/js/impl/SimpleManager'

chai.use(chaiAsPromised)
chai.should()

const verbose = false

before(async function () {
// TODO: get accounts
})

describe('SimpleManager', async function () {
  const email = 'hello@world.com'
  const ethNodeUrl = 'http://localhost:8545'
  const from = '0x90f8bf6a479f320ead074411a4b0e7944ea8c9c1'

  let sm

  beforeEach(async function () {
    sm = new SimpleManager({})
  })

  describe('#googleLogin()', async function () {
    it('should return promise with JWT if user approves oauth login request', async function () {
      sm.accountApi = {
        googleLogin: function () {
          return new Promise((resolve, reject) => {
            setTimeout(() => {
              resolve({ jwt: 'TODO', email: email, address: '' })
            }, 1)
          })
        }
      }
      const { jwt, email: jwtEmail, address } = await sm.googleLogin()
      assert.strictEqual(jwt, 'TODO')
      assert.strictEqual(jwtEmail, email)
      assert.strictEqual(address, '')
    })

    it('should reject promise with error if user rejects oauth login request', async function () {
      sm.accountApi = {
        googleLogin: function () {
          return new Promise((resolve, reject) => {
            setTimeout(() => {
              reject(new Error('Client rejected'))
            }, 1)
          })
        }
      }
      const promise = sm.googleLogin()
      await expect(promise).to.eventually.be.rejectedWith('Client rejected')
    })
  })

  describe('#validatePhone()', async function () {
    it('should pass parameters to backend and handle http 200 OK code', async function () {
      sm.backend = {
        validatePhone: sinon.spy(() => { return { code: 200 } })
      }
      const jwt = {}
      const phone = '0000'
      const { success, reason } = await sm.validatePhone({ jwt, phone })
      assert.strictEqual(success, true)
      assert.strictEqual(reason, null)
      expect(sm.backend.validatePhone.calledOnce).to.be.true
      expect(sm.backend.validatePhone.firstCall.args[0]).to.eql({ jwt, phone })
    })
  })

  describe('#createWallet()', async function () {
    let mockhub
    let factory
    let sponsor
    let forward
    let web3
    let web3provider

    before(async function () {
      web3provider = new Web3.providers.HttpProvider(ethNodeUrl)
      mockhub = await FactoryContractInteractor.deployMockHub(from, ethNodeUrl)
      sponsor = await FactoryContractInteractor.deploySponsor(from, mockhub.address, ethNodeUrl)
      const forwarderAddress = await sponsor.contract.methods.getGsnForwarder().call()
      forward = await FactoryContractInteractor.getGsnForwarder({ address: forwarderAddress, provider: web3provider })
      factory = await FactoryContractInteractor.deployNewVaultFactory(from, ethNodeUrl, forward.address)
      const spHub = await sponsor.contract.methods.getHubAddr().call()
      const fwHub = await forward.contract.methods.getHubAddr().call()
      const vfHub = await factory.contract.methods.getHubAddr().call()
      const vfFwd = await factory.contract.methods.getGsnForwarder().call()
      web3 = new Web3(web3provider)
      if (!verbose) {
        return
      }
      console.log(`spHub = ${spHub} fwHub=${fwHub} vfHub=${vfHub} vfFwd=${vfFwd}`)
      console.log(`mockhub = ${mockhub.address} factory=${factory.address} sponsor=${sponsor.address} forward=${forward.address}`)
    })

    describe('main flows', async function () {
      const approvalData = '0x1234'
      let sm
      beforeEach(async function () {
        sm = new SimpleManager({ email: email })
        sm.accountApi = {
          googleAuthenticate: function () {
            return { jwt: 'TODO' }
          }
        }
        sm.backend = {
          createAccount: function () {
            return {
              vaultId: '0x203040',
              approvalData: 'a3a6839853586edc9133e9c71d4ccfac678b4fc3f5475fd3014845ad5287870f'
            }
          }
        }
        sm.factoryConfig =
          {
            factoryAddress: factory.address
          }
      })

      it('should deploy a new vault using SponsorProvider', async function () {
        const httpSend = {
          send: function (url, jsd, callback) {
            if (url.includes('hello world/getaddr')) {
              callback(null, {
                Ready: true,
                MinGasPrice: 0,
                RelayServerAddress: from,
                relayUrl: 'hello world',
                transactionFee: 0
              })
              return
            }
            if (url.includes('hello world/relay')) {
              const sig = Web3Utils.bytesToHex(jsd.signature)
              const appr = Web3Utils.bytesToHex(jsd.approvalData)
              const encodeABI = mockhub.contract.methods.relayCall(
                jsd.from, jsd.to, jsd.encodedFunction,
                jsd.relayFee, jsd.gasPrice, jsd.gasLimit, jsd.RecipientNonce, sig, appr).encodeABI()
              mockhub.relayCall(
                jsd.from, jsd.to, jsd.encodedFunction,
                jsd.relayFee, jsd.gasPrice, jsd.gasLimit, jsd.RecipientNonce, sig, appr, {
                  from: from,
                  gasPrice: jsd.gasPrice,
                  gas: jsd.gasLimit
                })
                .then(res => {
                  web3.eth.getTransactionCount(from)
                    .then(nonce => {
                      const relayedTx = {
                        nonce: nonce - 1,
                        v: res.receipt.v,
                        r: res.receipt.r,
                        s: res.receipt.s,
                        gasPrice: jsd.gasPrice,
                        gas: jsd.gasLimit,
                        to: res.receipt.to,
                        value: 0,
                        input: encodeABI
                      }
                      callback(null, relayedTx)
                    })
                })
            }
          }
        }
        sm.factoryConfig.provider = await SponsorProvider.init(web3provider,
          {
            httpSend: httpSend,
            verbose: true,
            sponsor: sponsor.address,
            proxyOwner: sm.getOwner()
          })
        await sm._initializeFactory(sm.factoryConfig)
        const wallet = await sm.createWallet({ approvalData })
        const operator = sm.getOwner().address.toLowerCase()
        const creator = (await wallet.contract.creator()).toLowerCase()
        assert.strictEqual(creator, operator)
      })
    })

    describe('secondary flows', async function () {
      it('should initialize vault factory contract if not initialized')

      it('should throw if there is no operator key')

      it('should throw if this user already has a vault deployed')
    })
  })

  describe('#googleAuthenticate()', async function () {
  })

  describe('#getWalletAddress()', async function () {
  })

  describe('#loadWallet()', async function () {
  })

  describe('#recoverWallet()', async function () {
  })
})

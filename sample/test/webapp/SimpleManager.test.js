/* eslint-disable no-unused-expressions */
/* global describe beforeEach before after it */
import assert from 'assert'
import { spawn } from 'child_process'
import chai, { expect } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import sinon from 'sinon'
import Web3 from 'web3'

import FactoryContractInteractor from 'safechannels-contracts/src/js/FactoryContractInteractor'

import { SponsorProvider } from 'gsn-sponsor'

import RelayServerMock from '../mocks/RelayServer.mock'
import SimpleManager from '../../src/js/impl/SimpleManager'
import ClientBackend from '../../src/js/backend/ClientBackend'
import { Backend } from '../../src/js/backend/Backend'
import { MockStorage } from '../mocks/MockStorage'
import Account from '../../src/js/impl/Account'
import { hookRpcProvider } from '../../src/js/utils/hookRpcProvider'

describe('#SimpleManager.test', () => {
  chai.use(chaiAsPromised)
  chai.should()

  const verbose = false
  const mockBackend = {
    createAccount: function () {
      return {
        approvalData: '0x' + 'f'.repeat(64),
        smartAccountId: '0x' + '1'.repeat(64)
      }
    }
  }

  const realBackend = new ClientBackend({ serverURL: 'http://localhost:8888/' })
  let ls
  let backendTestInstance

  before(async function () {
    // TODO: get accounts

    backendTestInstance = new Backend(
      { audience: '202746986880-u17rbgo95h7ja4fghikietupjknd1bln.apps.googleusercontent.com' })
    backendTestInstance.secretSMSCodeSeed = Buffer.from('f'.repeat(64), 'hex')

    await new Promise((resolve, reject) => {
      ls = spawn('node', [
        '-r',
        'esm',
        '../sample/src/js/backend/runServer.js',
        '8888',
        'factoryaddr',
        'sponsoraddr',
        '--dev'])
      ls.stdout.on('data', (data) => {
        console.log(`stdout: ${data}`)
        if (data.includes('listening')) {
          resolve()
        }
      })
      ls.stderr.on('data', (data) => {
        console.error(`stderr: ${data}`)
      })
      ls.on('close', (code) => {
        console.log(`child process exited with code ${code}`)
        reject(Error('process quit'))
      })
    })
  })

  after(async function () {
    ls.kill(9)
  })

  const backends = [
    {
      backend: mockBackend, name: 'Mock Backend'
    },
    {
      backend: realBackend, name: 'Real Backend'
    }
  ]

  backends.forEach(function ({ backend, name }) {
    describe(`SimpleManager with ${name}`, async function () {
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
          const phoneNumber = '0000'
          const { success, reason } = await sm.validatePhone({ jwt, phoneNumber })
          assert.strictEqual(success, true)
          assert.strictEqual(reason, null)
          expect(sm.backend.validatePhone.calledOnce).to.be.true
          expect(sm.backend.validatePhone.firstCall.args[0]).to.eql({ jwt, phoneNumber })
        })
      })

      describe('#createWallet()', async function () {
        let mockhub
        let factory
        let sponsor
        let forward
        let web3provider

        const jwt = require('../backend/testJwt').jwt
        const phoneNumber = '+1-541-754-3010'

        before(async function () {
          web3provider = new Web3.providers.HttpProvider(ethNodeUrl)

          mockhub = await FactoryContractInteractor.deployMockHub(from, ethNodeUrl)
          sponsor = await FactoryContractInteractor.deploySponsor(from, mockhub.address, ethNodeUrl)
          const forwarderAddress = await sponsor.contract.methods.getGsnForwarder().call()
          forward = await FactoryContractInteractor.getGsnForwarder({
            address: forwarderAddress,
            provider: web3provider
          })
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

        describe('main flows', async function () {
          let factoryConfig
          let sm

          before(async function () {
            const storage = new MockStorage()
            // storage.data.ownerAddress = '0x90f8bf6a479f320ead074411a4b0e7944ea8c9c1';
            // storage.data.privKey = '0x4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d';
            const accountApi = new Account(storage)
            accountApi.googleLogin()

            const relayOptions = {
              httpSend: new RelayServerMock({
                mockHubContract: mockhub,
                relayServerAddress: from,
                web3provider: web3provider
              }),
              sponsor: sponsor.address,
              proxyOwner: {
                address: await accountApi.getOwner()
                // privateKey: accountApi.storage.privKey
              }
            }
            const signerProvider = hookRpcProvider(web3provider, {
              eth_sign: async function (account, hash) {
                if (account !== await accountApi.getOwner()) {
                  throw new Error('wrong signer: not valid account')
                }
                return accountApi.signMessageHash(hash)
              }
            })

            const sponsorProvider = await SponsorProvider.init(signerProvider, relayOptions)

            factoryConfig = {
              provider: sponsorProvider,
              factoryAddress: factory.address
            }
            sm = new SimpleManager({
              email: email,
              accountApi: accountApi,
              backend: backend,
              factoryConfig: factoryConfig
            })
          })

          it('should deploy a new SmartAccount using SponsorProvider', async function () {
            const minuteTimestamp = backendTestInstance._getMinuteTimestamp({})
            const smsVerificationCode = backendTestInstance._calcSmsCode({
              phoneNumber: backendTestInstance._formatPhoneNumber(phoneNumber),
              email: 'shahaf@tabookey.com',
              minuteTimeStamp: minuteTimestamp
            })
            const wallet = await sm.createWallet({ jwt, phoneNumber, smsVerificationCode })
            const operator = (await sm.getOwner()).toLowerCase()
            const creator = (await wallet.contract.creator()).toLowerCase()
            assert.strictEqual(creator, operator)
          })
        })

        describe('secondary flows', async function () {
          it('should throw if there is no operator set')

          it('should throw if this user already has a SmartAccount deployed')
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
  })
})

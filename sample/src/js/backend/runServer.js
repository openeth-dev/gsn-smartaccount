/*
  Run with:
  node -r esm <path_to_script>/runServer.js <port> <factoryAddress> <sponsorAddress> <ethNodeUrl> [<devMode>]
 */

import Webserver from './Webserver'
import { Backend } from './Backend'
import SMSmock from '../mocks/SMS.mock'
import { KeyManager } from './KeyManager'
import { hookBackend } from '../../../test/backend/testutils'
import { SmsManager } from './SmsManager'
import { AccountManager } from './AccountManager'
import crypto from 'crypto'
import { Watchdog, Admin } from './Guardian'
import Web3 from 'web3'

const port = process.argv[2]
const factoryAddress = process.argv[3]
const sponsorAddress = process.argv[4]
const ethNodeUrl = process.argv[5]
const smsProvider = new SMSmock()
const smsManager = new SmsManager({ smsProvider, secretSMSCodeSeed: crypto.randomBytes(32) })
const keypair = KeyManager.newKeypair()
const keyManager = new KeyManager({ ecdsaKeyPair: keypair })
const accountManager = new AccountManager()
const web3provider = new Web3.providers.WebsocketProvider(ethNodeUrl)
const watchdog = new Watchdog({
  smsManager,
  keyManager,
  accountManager,
  smartAccountFactoryAddress: factoryAddress,
  sponsorAddress: sponsorAddress,
  web3provider: web3provider
})
const admin = new Admin({
  smsManager,
  keyManager,
  accountManager,
  smartAccountFactoryAddress: factoryAddress,
  sponsorAddress: sponsorAddress,
  web3provider: web3provider
})
const backend = new Backend(
  {
    smsManager,
    audience: '202746986880-u17rbgo95h7ja4fghikietupjknd1bln.apps.googleusercontent.com',
    keyManager,
    accountManager,
    admin: admin
  })

// update Date.now() on every ETH-block timestamp.
function hookNodeTime () {
  // hook nodejs global Date class
  require('../mocks/MockDate')

  const web3 = new Web3(web3provider)
  web3.eth.subscribe('newBlockHeaders', function (error, blockHeader) {
    if (error) {
      console.error(error)
    }
  }).on('data', blockHeader => {
    const diff = Math.floor(blockHeader.timestamp - Date.now() / 1000)
    if (Math.abs(diff) > 10) {
      console.log('=== time-gap: time changed by ', diff, 'seconds')
    }
    Date.setMockedTime(blockHeader.timestamp * 1000)
  })
}

if (process.argv[6] === '--dev') {
  console.log('Running server in dev mode')
  hookBackend(backend)
  hookNodeTime()
  smsManager.secretSMSCodeSeed = Buffer.from('f'.repeat(64), 'hex')
}

console.log('server address=' + backend.keyManager.address())

const server = new Webserver({ port, backend, watchdog, admin })
server.start()

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
import { Watchdog } from './Guardian'
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
const backend = new Backend(
  {
    smsManager,
    audience: '202746986880-u17rbgo95h7ja4fghikietupjknd1bln.apps.googleusercontent.com',
    keyManager,
    accountManager,
    guardian: watchdog
  })
const admin = undefined // TODO

if (process.argv[6] === '--dev') {
  console.log('Running server in dev mode')
  hookBackend(backend)
  smsManager.secretSMSCodeSeed = Buffer.from('f'.repeat(64), 'hex')
}

console.log('server address=' + backend.keyManager.address())

const server = new Webserver({ port, backend, watchdog, admin })
server.start()

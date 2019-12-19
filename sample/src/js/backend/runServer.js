/*
  Run with:
  node -r esm <path_to_script>/runServer.js <port> [<devMode>]
 */

import Webserver from './Webserver'
import { Backend } from './Backend'
import SMSmock from '../mocks/SMS.mock'
import { KeyManager } from './KeyManager'
import { hookBackend } from '../../../test/backend/testutils'
import { SmsManager } from './SmsManager'
import { AccountManager } from './AccountManager'
import crypto from 'crypto'

const port = process.argv[2]
const factoryAddress = process.argv[3]
const sponsorAddress = process.argv[4]
const smsProvider = new SMSmock()
const smsManager = new SmsManager({ smsProvider, secretSMSCodeSeed: crypto.randomBytes(32) })
const keypair = KeyManager.newEphemeralKeypair()
const keyManager = new KeyManager({ ecdsaKeyPair: keypair })
const accountManager = new AccountManager()
const backend = new Backend(
  {
    smsManager,
    audience: '202746986880-u17rbgo95h7ja4fghikietupjknd1bln.apps.googleusercontent.com',
    keyManager,
    accountManager,
    factoryAddress,
    sponsorAddress
  })

if (process.argv[5] === '--dev') {
  console.log('Running server in dev mode')
  hookBackend(backend)
  smsManager.secretSMSCodeSeed = Buffer.from('f'.repeat(64), 'hex')
}

console.log('server address=' + backend.keyManager.address())

const server = new Webserver({ port, backend })
server.start()

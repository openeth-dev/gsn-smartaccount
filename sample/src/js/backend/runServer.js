/*
  Run with:
  node -r esm <path_to_script>/runServer.js <port> [<devMode>]
 */

import Webserver from './Webserver'
import { Backend } from './Backend'
import Wallet from 'ethereumjs-wallet'
import SMSmock from '../mocks/SMS.mock'

function newEphemeralKeypair () {
  const a = Wallet.generate()
  return {
    privateKey: a.privKey,
    address: '0x' + a.getAddress().toString('hex')
  }
}

function hookBackend (backend) {
  backend._verifyJWT = async function (jwt) {
    const parsed = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64'))

    return {
      getPayload: () => parsed
    }
  }
  backend.secretSMSCodeSeed = Buffer.from('f'.repeat(64), 'hex')
}

const port = process.argv[2]
const smsProvider = new SMSmock()
const keypair = newEphemeralKeypair()
const backend = new Backend(
  {
    smsProvider,
    audience: '202746986880-u17rbgo95h7ja4fghikietupjknd1bln.apps.googleusercontent.com',
    ecdsaKeyPair: keypair
  })

if (process.argv[3] === '--dev') {
  console.log('Running server in dev mode')
  hookBackend(backend)
}

console.log('server address=' + keypair.address)

const server = new Webserver({ port, backend })
server.start()

/*
  Run with:
  node -r esm <path_to_script>/runServer.js <port>
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

const port = process.argv[2]
const smsProvider = new SMSmock()
const keypair = newEphemeralKeypair()
const backend = new Backend(
  {
    smsProvider,
    audience: '202746986880-u17rbgo95h7ja4fghikietupjknd1bln.apps.googleusercontent.com',
    ecdsaKeyPair: keypair
  })

const server = new Webserver({ port, backend })
server.start()

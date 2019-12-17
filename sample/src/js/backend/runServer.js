/*
  Run with:
  node -r esm <path_to_script>/runServer.js <port> [<devMode>]
 */

import Webserver from './Webserver'
import { Backend } from './Backend'
import Wallet from 'ethereumjs-wallet'
import SMSmock from '../mocks/SMS.mock'
import { LoginTicket } from 'google-auth-library/build/src/auth/loginticket'
import ticket from '../../../test/backend/ticket.json'

function newEphemeralKeypair () {
  const a = Wallet.generate()
  return {
    privateKey: a.privKey,
    address: '0x' + a.getAddress().toString('hex')
  }
}

function hookBackend (backend) {
  // backend.gclient._orig_verifyIdToken = backend.gclient.verifyIdToken
  // const verifyFn = async function ({ idToken, audience }) {
  //   try {
  //     return await backend.gclient._orig_verifyIdToken({ idToken, audience })
  //   } catch (e) {
  //     console.log('hooking google auth verifyIdToken() function')
  //     if (e.toString().includes('Error: Token used too late')) {
  //       const loginTicket = new LoginTicket(ticket.envelope, ticket.payload)
  //       return loginTicket
  //     }
  //   }
  // }

  const verifyFn = async function ({ idToken, audience }) {
    const parsed = JSON.parse(Buffer.from(idToken.split('.')[1], 'base64'))
    if (parsed.aud !== audience) { throw new Error('unexpected JWT aud:' + parsed.aud) }

    return {
      getPayload: () => parsed
    }
  }
  backend.secretSMSCodeSeed = Buffer.from('f'.repeat(64), 'hex')
  backend.gclient.verifyIdToken = verifyFn
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

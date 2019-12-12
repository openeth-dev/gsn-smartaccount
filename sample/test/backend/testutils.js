import { LoginTicket } from 'google-auth-library/build/src/auth/loginticket'

export function hookBackend (backend, verifyFn) {
  backend.gclient._orig_verifyIdToken = backend.gclient.verifyIdToken
  verifyFn = async function ({ idToken, audience }) {
    try {
      return await backend.gclient._orig_verifyIdToken({ idToken, audience })
    } catch (e) {
      console.log('hooking google auth verifyIdToken() function')
      const rawTicket = require('./ticket')
      return new LoginTicket(rawTicket.envelope, rawTicket.payload)
    }
  }
  backend.gclient.verifyIdToken = verifyFn
}

export function unhookBackend (backend) {
  backend.gclient.verifyIdToken = backend.gclient._orig_verifyIdToken
  delete backend.gclient._orig_verifyIdToken
}

export function sleep (ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

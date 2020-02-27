import { LoginTicket } from 'google-auth-library/build/src/auth/loginticket'

export function hookBackend (backend) {
  backend.gclient._orig_verifyIdToken = backend.gclient.verifyIdToken
  const verifyFn = async function ({ idToken, audience }) {
    try {
      return await backend.gclient._orig_verifyIdToken({ idToken, audience })
    } catch (e) {
      console.log('hooking google auth verifyIdToken() function')
      const rawTicket = require('./ticket')
      rawTicket.payload = JSON.parse(Buffer.from(idToken.split('.')[1], 'base64').toString())

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

// return a structurely-valid JWT (though signature is bogus..)
export function generateMockJwt ({ email, nonce, iat, exp }) {
  const part1 = Buffer.from(JSON.stringify({
    alg: 'RS256',
    kid: '5b5dd9be40b5e1cf121e3573c8e49f12527183d3',
    typ: 'JWT'
  })).toString('base64')
  const aud = '202746986880-u17rbgo95h7ja4fghikietupjknd1bln.apps.googleusercontent.com'
  const azp = aud
  const iss = 'accounts.google.com'
  const part2 = Buffer.from(JSON.stringify(
    { aud, azp, iss, email, email_verified: true, nonce, iat, exp })).toString('base64')
  const part3 = 'SIG'
  return [part1, part2, part3].join('.')
}

export function hookFunction (obj, funcName, newFunc) {
  Object.defineProperty(newFunc, 'name', {
    writable: true,
    value: funcName
  })
  obj[funcName + 'Orig'] = obj[funcName]
  obj[funcName] = newFunc
}

export function unhookFunction (obj, funcName) {
  obj[funcName] = obj[funcName + 'Orig']
  delete obj[funcName + 'Orig']
}

export const backendPort = 8888
export const urlPrefix = 'http://srulik.lan:3000/?'

/* global error */

//API for google oauth API.
import GauthApi from '../api/Gauth.api'

const EMAIL = 'shahaf@tabookey.com'

export default class GauthMock extends GauthApi {

  constructor (params) {
    super()
    this.params = { email: EMAIL, ...params }
  }

  //extra params from:
  // https://developers.google.com/identity/sign-in/web/reference#gapiauth2initparams
  async init (init_params) {
    console.log('gauth initialize.')
  }

  // return a structurely-valid JWT (though signature is bogus..)
  _generateMockJwt ({ email, nonce, iat, exp }) {
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

  async signIn (params) {
    let newemail
    if (typeof window !== 'undefined') {
      newemail = window.prompt('google login email')
      if (!newemail)
        return
    } else {
      newemail = 'shahaf@tabookey.com'
    }
    this.params.email = newemail
    return this.info()
  }

  async signOut () {
    console.log('logout')
  }

  info () {
    const { email, nonce } = { ...this.params }
    return {
      email,
      jwt: this._generateMockJwt({ email, nonce })
    }
  }
}

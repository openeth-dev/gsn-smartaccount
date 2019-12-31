/* global error */

import validate from '../utils/XfaceValidate'

// API for google oauth API.
export default class GauthApi {
  constructor () {
    validate(GauthApi, this)
  }

  init (params) {
    error('set params to gauth (most notably: nonce). can\'t be changed later.')
  }

  async signIn () {
    error('return {email,jwt}. throws on manual close (or errors)')
  }

  async signOut () {
    error('logout')
  }

  async info () {
    error('return current {email,jwt}, or null if not signed in')
  }
}

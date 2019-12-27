/* global error */

import validate from '../utils/XfaceValidate'

//API for google oauth API.
export default class GauthApi {

  constructor () {
    validate(GauthApi, this)
  }

  //extra params from:
  // https://developers.google.com/identity/sign-in/web/reference#gapiauth2initparams
  async init (init_params) {
    error('initialize.')
  }

  async signIn (params) {
    error('return {email,jwt}. throws on manual close (or errors)')
  }

  async signOut () {
    error('logout')
  }

  info () {
    error('return current {email,jwt}')
  }
}

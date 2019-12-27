import axios from 'axios'

const CLIENT_ID = '202746986880-u17rbgo95h7ja4fghikietupjknd1bln.apps.googleusercontent.com'

export class Gauth {

  //extra params from:
  // https://developers.google.com/identity/sign-in/web/reference#gapiauth2initparams
  constructor (init_params) {
    this.default_params = {
      ...init_params,
      client_id: CLIENT_ID
    }
  }

  //extra params from:
  // https://developers.google.com/identity/sign-in/web/reference#gapiauth2initparams
  async init (init_params) {

    if (!global.gapi) {
      let script = await axios.get('https://apis.google.com/js/platform.js')
      eval(script.data)
    }

    await new Promise((resolve) => {
      //after eval, should have 'gapi' in global context..
      gapi.load('auth2', resolve)
    })

    let params = {
      ...this.default_params,
      ...init_params
    }
    gapi.auth2.init(params)
    this.params = params
    this.gauth = await gapi.auth2.getAuthInstance()
  }

  async _reinit (params={}) {
    let newparams = {
      ...this.default_params,
      ...params
    }
    if (Object.entries(newparams).sort().toString() ===
      Object.entries(this.params | {}).sort().toString()) {

      //same init params. do nothing.
      return
    }
    await this.init(params)
  }

  async signIn (params) {
    await this._reinit(params)
    await this.gauth.signIn()
    return this.info()
  }

  async signOut (params) {
    await this._reinit(params)
    return this.gauth.signOut()
  }

  info () {
    if (!this.gauth)
      return { error: 'no gauth' }
    if (!this.gauth.currentUser)
      return { error: 'no currentUser' }
    if (!this.gauth.currentUser.get().getBasicProfile())
      return { error: 'no profile' }
    const email = this.gauth.currentUser.get().getBasicProfile().getEmail()
    let jwt = this.gauth.currentUser.get().getAuthResponse().id_token

    return { email, jwt: jwt }
  }
}

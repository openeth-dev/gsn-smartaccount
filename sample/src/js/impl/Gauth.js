/* global gapi */
import axios from 'axios'
import GauthApi from '../api/Gauth.api'

// wsample
const CLIENT_ID = '966448872848-td59kkdbgdk4r1pngbmf71mor450upn0.apps.googleusercontent.com'

// SmartAccount app: https://console.developers.google.com/apis/credentials?highlightClient=966448872848-td59kkdbgdk4r1pngbmf71mor450upn0.apps.googleusercontent.com&project=smartaccount-263422&organizationId=208398235469
// const CLIENT_ID = '966448872848-td59kkdbgdk4r1pngbmf71mor450upn0.apps.googleusercontent.com'

export class Gauth extends GauthApi {
  // extra params from:
  // https://developers.google.com/identity/sign-in/web/reference#gapiauth2initparams
  init (params) {
    this.params = {
      ...params,
      client_id: CLIENT_ID
    }
  }

  // extra params from:
  // https://developers.google.com/identity/sign-in/web/reference#gapiauth2initparams
  async _init () {
    if (this.gauth) {
      return // already initialized
    }
    if (!global.gapi) {
      const script = await axios.get('https://apis.google.com/js/platform.js')
      // eslint-disable-next-line no-eval
      eval(script.data)
    }

    await new Promise((resolve) => {
      // after eval, should have 'gapi' in global context..
      gapi.load('auth2', resolve)
    })

    // ugly syntax, but that's what google specifies:
    await gapi.auth2.init(this.params).then()
    this.gauth = gapi.auth2.getAuthInstance()
  }

  async signIn () {
    await this._init()
    await this.gauth.signIn()
    return this.info()
  }

  async signOut () {
    return this.gauth.signOut()
  }

  async info () {
    await this._init()
    if (!this.gauth) { return { error: 'no gauth' } }
    if (!this.gauth.currentUser) { return { error: 'no currentUser' } }
    if (!this.gauth.currentUser.get().getBasicProfile()) { return { error: 'no profile' } }
    const email = this.gauth.currentUser.get().getBasicProfile().getEmail()
    const jwt = this.gauth.currentUser.get().getAuthResponse().id_token

    return { email, jwt }
  }
}

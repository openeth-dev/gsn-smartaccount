/* global error */
// our wallet Account: (iframe: account.safechannel.com)
// eslint-disable-next-line no-unused-vars
import validate from '../utils/XfaceValidate'
export default class AccountApi {
  constructor () {
    // validate child contract implemented all core functions
    validate(AccountApi, this)
  }

  getEmail () {
    error('iframe: return current google logged in email (google account), or null')
  }

  getOwner () {
    error('iframe: return owner\'s address (a cookie in an iframe)')
  }

  async googleLogin () {
    error('iframe: open google auth popup. save to localStorage email,address (and privKey). return {jwt, email, address}. throw if canceled/failed')
  }

  async googleAuthenticate () {
    error('iframe: return fresh JWT token, with no UI (almost identical to googleLogin())')
  }

  async signTransaction ({ tx }) {
    error('sign transaction. might popup UI for user')
  }

  async signOut () {
    error('forget current address,private key and google account')
  }
}

// static object in client app.
// core API to access iframe (google email, address, sign)

import validate from '../utils/XfaceValidate'
import EventEmitter from 'events'

export default class SimpleManagerApi extends EventEmitter {
  constructor () {
    super()
    validate(SimpleManagerApi, this)
    this.accountApi = undefined
  }

  // wrapper calls for the background IFRAME:

  async getEmail () {
    error('return this.accountApi.getEmail()')
  }

  async getOwner () {
    error('return this.accountApi.getOwner()')
  }

  async googleLogin () {
    error('return this.accountApi.googleLogin()')
  }

  async signOut () {
    error('sign out of google account, forget local private/public keys')
  }

  async googleAuthenticate () {
    error('return this.accountApi.googleAuthenticate()')
  }

  async getWalletAddress () {
    error('return the wallet address (valid only after is was created on-chain)')
  }

  async hasWallet () {
    error('check if a wallet exists for this email)')
  }

  async signInAsNewOperator ({ jwt, description, observer }) {
    error('ask backend to add our address as an operator for existing vault')
  }

  /**
   *
   * @param observer: function(newState){ ... }
   * @param interval: how often should the manager query the blockchain (TBD)
   */
  async setSignInObserver ({ observer, interval }) {
    error('callback should be called when sign in events happen')
  }

  // TODO: maybe beter have getInitialConfiguration(), and pass its value to createWallet.
  // no need for the client to know these are 2 separate transaction (and we're going to
  // make them a single transaction in the future..)
  async setInitialConfiguration () {
    error('perform initial configuration of a wallet. must be called after createWallet')
  }

  async loadWallet () {
    error(
      'return a SimpleWallet object for the current google account (after it was created)')
  }

  async validatePhone ({ jwt, phoneNumber }) {
    error(
      'contact backend to send SMS with verification code to client). mock emit event "mocksms". real server sends SMS')
  }

  async createWallet ({ jwt, phoneNumber, smsVerificationCode }) {
    error('create contract via GSN. returns after wallet created on chain. must call setInitialConfiguration() to complete creation')
  }

  async recoverWallet ({ jwt }) {
    error('trigger recover flow')
  }

  async validateRecoverWallet ({ jwt, smsCode }) {
    error('schedules add operator configuration')
  }

  async cancelByUrl ({ jwt, url }) {
    error('requests backend watchdog to cancel the operation. used in case the operator key is not available')
  }
}

function error (msg) {
  throw new Error(msg)
}

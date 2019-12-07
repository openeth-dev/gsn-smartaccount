// static object in client app.
// core API to access iframe (google email, address, sign)
// eslint-disable-next-line no-unused-vars

import validate from '../utils/XfaceValidate'
import EventEmitter from 'events'

export default class SimpleManagerApi extends EventEmitter {
  constructor () {
    super()
    validate(SimpleManagerApi, this)
    this.accountApi = undefined
  }

  // wrapper calls for the background IFRAME:

  getEmail () {
    error('return this.accountApi.getEmail()')
  }

  getOwner () {
    error('return this.accountApi.getOwner()')
  }

  async googleLogin () {
    error('return this.accountApi.googleLogin()')
  }

  async getWalletAddress () {
    error('return the wallet address (valid only after is was created)')
  }

  async hasWallet () {
    error('check if a wallet exists for this email)')
  }

  async loadWallet () {
    error('return a SampleWallet object for the current google account (after it was created)')
  }

  async validatePhone ({ jwt, phone }) {
    error('contact backend to send SMS with verification code to client). mock emit event "mocksms". real server sends SMS')
  }

  async createWallet ({ jwt, phone, smsVerificationCode }) {
    error('create contract via GSN. returns after wallet created on chain.')
  }

  async recoverWallet ({ owner, email }) {
    error('trigger recover flow')
  }
}

function error (msg) {
  throw new Error(msg)
}

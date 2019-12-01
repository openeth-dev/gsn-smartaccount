// static object in client app.
// core API to access iframe (google email, address, sign)
// eslint-disable-next-line no-unused-vars
class SimpleManagerApi {
  constructor () {
    require('./XfaceValidate')(SimpleManagerApi, this)
    this.accountApi = undefined
  }

  // wrapper calls for the background IFRAME:

  getEmail () {
    return this.accountApi.getEmail()
  }

  getOwner () {
    return this.accountApi.getOwner()
  }

  async googleLogin () {
    return this.accountApi.googleLogin()
  }

  async googleAuthenticate () {
    return this.accountApi.googleAuthenticate()
  }

  async getWalletAddress () {
    error('return the wallet address (valid only after is was created)')
  }

  async hasWallet () {
    error('check if a wallet exists for this email)')
  }

  async loadWallet (email) {
    error('return a SampleWallet object for this email (after it was created)')
  }

  async createAccount ({ jwt, smsVerificationCode }) {
    error('create user account (mapping of email/userinfo/phone on BE, not contract). return approvalData')
  }

  createWallet ({ owner, email, approvalData }) {
    error('create contract via GSN')
  }

  recoverWallet ({ owner, email }) {
    error('trigger recover flow')
  }
}

function error (msg) {
  throw new Error(msg)
}

module.exports = { SimpleManagerApi }

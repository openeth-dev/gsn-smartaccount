/* global error */

import SimpleManagerApi from '../api/SimpleManager.api.js'
import SampleWalletMock from './SampleWallet.mock.js'
import AccountMock from './Account.mock'
import SMSmock from './SMS.mock'

// API of the main factory object.
export default class SimpleManagerMock extends SimpleManagerApi {
  constructor (props) {
    super(props)
    props = props || {}
    this.accountApi = props.accountApi || new AccountMock()
    this.smsApi = props.smsApi || new SMSmock()
  }

  getEmail () {
    return this.accountApi.getEmail()
  }

  getOwner () {
    return this.accountApi.getOwner()
  }

  async googleLogin () {
    const ret = await this.accountApi.googleLogin()
    return ret
  }

  async signOut () {
    this.wallet = null
    return this.accountApi.signOut()
  }

  async googleAuthenticate () {
    return this.accountApi.googleAuthenticate()
  }

  async getWalletAddress () {
    if (this.getEmail() == null) {
      console.log('getWalletAddress: no email, no addr')
      return null
    }
    // console.log( "getWalletAddress: has email. addr=", this.deployedWalletAddress)
    return this.deployedWalletAddress || null
  }

  async hasWallet () {
    return this.deployedWalletAddress != null
  }

  async validatePhone ({ jwt, phone }) {
    if (!jwt || !jwt.email) {
      throw new Error('not logged in')
    }
    if (await this.hasWallet()) {
      throw new Error('wallet already exists')
    }

    // TODO: use mock SMS service..
    setTimeout(() => {
      const smsVerificationCode = 'v' + phone
      const smsUrl = 'http://server.com/?verify=' + smsVerificationCode
      this.smsApi.sendSms({
        phone: phone,
        message: 'To verify your email,\n' +
          'enter verification code: ' + smsVerificationCode + '\n' +
          'or click here: ' + smsUrl + '\n'
      })
    }, 10)
  }

  async createWallet ({ jwt, phone, smsVerificationCode }) {
    console.log('asd')
    if (smsVerificationCode !== 'v' + phone) {
      throw new Error('wrong verification code')
    }
    if (await this.hasWallet()) {
      throw new Error('wallet already exists')
    }

    this.deployedWalletAddress = 'waddr'
    return this.loadWallet()
  }

  async loadWallet () {
    if (!this.wallet) {
      if (!this.getEmail()) {
        throw new Error('not logged in')
      }
      if (!this.getWalletAddress()) {
        throw new Error('wallet not deployed')
      }
      // wallet address is derived from email...
      this.wallet = new SampleWalletMock(
        { email: this.getEmail(), address: this.deployedWalletAddress })
    }
    return this.wallet
  }

  async recoverWallet ({ owner, email }) {
    error('trigger recover flow')
  }
}

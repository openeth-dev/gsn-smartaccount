/* global error */

import SimpleManagerApi from '../../src/js/api/SimpleManager.api.js'
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
    return this.accountApi.googleLogin()
  }

  async getWalletAddress () {
    if (await this.hasWallet()) {
      return this.wallet.address
    }

    return null
  }

  async hasWallet () {
    return this.wallet != null
  }

  async validatePhone ({ jwt, phone }) {
    // TODO: use mock SMS service..
    setTimeout(() => {
      const smsVerificationCode = 'v:' + phone
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
    if (smsVerificationCode !== 'v:' + phone) {
      throw new Error('not our sms verification code')
    }

    if (await this.hasWallet()) {
      throw new Error('wallet already exists')
    }
    return this.loadWallet()
  }

  async loadWallet () {
    if (!this.wallet) {
      this.wallet = new SampleWalletMock(
        { email: this.getEmail(), address: await this.getWalletAddress() })
    }
    return this.wallet
  }

  async recoverWallet ({ owner, email }) {
    error('trigger recover flow')
  }
}

module.exports = { SimpleManagerMock }

/* global error */

import SimpleManagerApi from '../../src/js/api/SimpleManager.api.js'
import SampleWalletMock from './SampleWallet.mock.js'
import AccountMock from './Account.mock'
import SMSmock from './SMS.mock'
import assert from 'assert'

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

  async googleAuthenticate () {
    return this.accountApi.googleAuthenticate()
  }

  async getWalletAddress () {
    if (this.hasWallet()) {
      return this.wallet.address
    }

    return null
  }

  hasWallet () {
    return this.wallet != null
  }

  async validatePhone ({ jwt, phone }) {
    // TODO: use mock SMS service..
    setTimeout(() => {
      const smsVerificationCode = 'verified:' + phone
      const smsUrl = 'http://server.com/?verify=' + smsVerificationCode
      this.smsApi.sendSms({
        phone: phone,
        message: `click url ${smsUrl}\n
                  verificationCode ${smsVerificationCode}`
      })
    }, 10)
  }

  async createWallet ({ jwt, phone, smsVerificationCode }) {
    assert.eq(smsVerificationCode, 'verified:' + phone,
      'not our sms verification code')
    if (this.hasWallet()) {
      throw new Error('wallet already exists')
    }
    return this.loadWallet()
  }

  async loadWallet () {
    if (!this.wallet) {
      this.wallet = new SampleWalletMock({ email: this.getEmail(), address: await this.getWalletAddress() })
    }
    return this.wallet
  }

  recoverWallet (owner, account) {
    error('trigger recover flow')
  }
}

module.exports = { SimpleManagerMock }

/* global error */

import SimpleManagerApi from '../api/SimpleManager.api.js'
import AccountMock from '../../../test/mocks/Account.mock'

// API of the main factory object.
export default class SimpleManagerMock extends SimpleManagerApi {
  constructor ({ accountApi }) {
    super()
    this.accountApi = accountApi || new AccountMock()
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

  validatePhone ({ jwt, phone }) {
    return this.backend.validatePhone({ jwt, phone })
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

  loadWallet () {
  }

  async createWallet ({ owner, email, approvalData }) {
  }

  recoverWallet (owner, account) {
    error('trigger recover flow')
  }
}

module.exports = { SimpleManagerMock }

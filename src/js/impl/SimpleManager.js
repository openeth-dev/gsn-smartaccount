/* global error */

import SimpleManagerApi from '../api/SimpleManager.api.js'
import { validate } from 'email-validator'

// API of the main factory object.
export default class SimpleManagerMock extends SimpleManagerApi {
  constructor ({ email }) {
    super()
    if (!validate(email)) {
      throw Error('Illegal email')
    }
    this.email = email
  }

  getEmail () {
    return this.email
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

  async createAccount () {
  }

  async createWallet ({ owner, email, approvalData }) {
  }

  recoverWallet (owner, account) {
    error('trigger recover flow')
  }
}

module.exports = { SimpleManagerMock }

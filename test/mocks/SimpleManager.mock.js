/* global error */

import { SimpleManagerApi } from '../../app/SimpleManager.api.js'

// API of the main factory object.
class SimpleManager extends SimpleManagerApi {
  getAccount () {
    return 'user@domain.com'
  }

  async googleLogin () {
    console.log('login UI')
  }

  getOwner () {
    return this.address
  }

  hasWallet (account) {
    return this.wallets[account] != null
  }

  loadWallet (account) {
    return this.wallets[account]
  }

  async createAccount () {

  }

  async createWallet (owner, account) {
    if (this.hasWallet(account)) {
      throw new Error('wallet already exists')
    }
    return { type: 'token', email: account }
  }

  createWallet2 (owner, account, token) {
    error('once token is signed, create a wallet for user.')
  }

  recoverWallet (owner, account) {
    error('trigger recover flow')
  }
}

module.exports = SimpleManager

/* global error */

import SimpleManagerApi from '../../src/js/api/SimpleManager.api.js'
import SampleWalletMock from './SampleWallet.mock.js'
import AccountMock from './Account.mock'

// API of the main factory object.
export default class SimpleManagerMock extends SimpleManagerApi {
  constructor (props) {
    super(props)
    this.accountApi = new AccountMock()
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
    this.wallet = new SampleWalletMock({ email: this.getEmail(), owner: this.getOwner() })
    return this.wallet
  }

  async createAccount () {

  }

  async createWallet ({ owner, email, approvalData }) {
    if (this.hasWallet()) {
      throw new Error('wallet already exists')
    }
    return this.loadWallet()
  }

  recoverWallet (owner, account) {
    error('trigger recover flow')
  }
}

module.exports = { SimpleManagerMock }

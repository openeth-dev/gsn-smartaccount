/* global error */

const { SimpleManagerApi } = require('../../app/SimpleManager.api.js')
const { SampleWalletMock } = require('./SampleWallet.mock.js')
const { AccountMock } = require('./Account.mock')

// API of the main factory object.
class SimpleManagerMock extends SimpleManagerApi {
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

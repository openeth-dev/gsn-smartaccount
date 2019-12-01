// our wallet Account: (iframe: account.safechannel.com)
const { AccountApi } = require('../../app/Account.api')

const localStorage = {}

class AccountMock extends AccountApi {
  constructor (options) {
    super()
    this.options = options
  }

  getEmail () {
    return localStorage.email
  }

  createOwner () {
    if (localStorage.ownerAddress) {
      throw new Error('owner already created')
    }
    if (!localStorage.email) {
      throw new Error('not logged in')
    }

    localStorage.ownerAddress = 'addr'
    localStorage.privateKey = 'privKey'
  }

  getOwner () {
    return localStorage.ownerAddress
  }

  async googleLogin () {
    if (this.verbose) {
      console.log('open google auth popup. prompt user for google account.\n')
    }
    localStorage.email = 'user@email.com'

    return {
      jwt: { email: localStorage.email, nonce: localStorage.ownerAddress || 'nonce' },
      email: localStorage.email,
      address: localStorage.ownerAddress
    }
  }

  async googleAuthenticate () {
    return {
      jwt: { email: localStorage.email, nonce: localStorage.ownerAddress || 'nonce' },
      email: localStorage.email,
      address: localStorage.ownerAddress
    }
  }

  async signOut () {
    localStorage.email = localStorage.ownerAddress = localStorage.privateKey = undefined
  }

  async signTransaction ({ tx }) {
    return { ...tx, signature: 'SIGSIGSIG' }
  }
}

module.exports = { AccountMock }

// our wallet Account: (iframe: account.safechannel.com)
import AccountApi from '../api/Account.api'

export default class AccountMock extends AccountApi {
  constructor (options) {
    super()
    this.options = options || {}
    this.storage = this.options.localStorage || {}
  }

  getEmail () {
    return this.storage.email
  }

  _createOwner () {
    this.storage.ownerAddress = 'addr'
    this.storage.privateKey = 'privKey'
  }

  getOwner () {
    return this.storage.ownerAddress
  }

  async googleLogin () {
    if (this.verbose) {
      console.log('open google auth popup. prompt user for google account.\n')
    }
    this.storage.email = 'user@email.com'
    if (!this.storage.ownerAddress) { this._createOwner() }

    return {
      jwt: { email: this.storage.email, nonce: this.storage.ownerAddress || 'nonce' },
      email: this.storage.email,
      address: this.storage.ownerAddress
    }
  }

  async googleAuthenticate () {
    return {
      jwt: { email: this.storage.email, nonce: this.storage.ownerAddress || 'nonce' },
      email: this.storage.email,
      address: this.storage.ownerAddress
    }
  }

  async signOut () {
    this.storage.email = this.storage.ownerAddress = this.storage.privateKey = undefined
  }

  async signMessage ({ message, messageHash }) {
    error(
      'sign message with "Ethereum Signed Message" prefix. might popup UI for user. messageHash is shorthand of "keccak(message)" ')
  }

  async signTransaction ({ tx }) {
    return { ...tx, signature: 'SIGSIGSIG' }
  }
}

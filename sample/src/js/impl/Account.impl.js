// our wallet Account: (iframe: account.safechannel.com)
import AccountApi from '../api/Account.api'

import ethWallet from 'ethereumjs-wallet'
import * as ethUtils from 'ethereumjs-util'

// import storageProps from './storageProps'

export function storageProps (storage) {
  return new Proxy(storage, {
    get (target, p) { return storage.getItem(p) },
    set (target, p, value) {
      if (value === undefined) {
        storage.removeItem(p)
      } else {
        storage.setItem(p, value)
      }
      return true
    }
  })
}

export default class Account extends AccountApi {
  // storage - property access.
  // localStorage - getItem/setItem (use only if no storage..)
  constructor ({ storage, localStorage }) {
    super()
    if (storage) {
      this.storage = storage
    } else if (localStorage) {
      // key/value API on top of Storage
      this.storage = storageProps(localStorage)
    } else {
      this.storage = {}
    }
  }

  async getEmail () {
    return this.storage.email
  }

  _createOwner () {
    if (this.storage.ownerAddress) {
      throw new Error('owner already created')
    }
    if (!this.storage.email) {
      throw new Error('not logged in')
    }

    const wallet = ethWallet.generate()
    const privKey = wallet.privKey
    const address = '0x' + wallet.getAddress().toString('hex')

    this.storage.ownerAddress = address
    this.storage.privKey = privKey
  }

  async getOwner () {
    return this.storage.ownerAddress
  }

  _getPrivKey () {
    return this.storage.privKey
  }

  async googleLogin () {
    if (this.verbose) {
      console.log('open google auth popup. prompt user for google account.\n')
    }
    this.storage.email = 'user@email.com'
    if (!this.storage.ownerAddress) {
      this._createOwner()
    }

    return {
      jwt: this._generateMockJwt({
        email: this.storage.email,
        nonce: this.storage.ownerAddress || 'nonce'
      }),
      email: this.storage.email,
      address: this.storage.ownerAddress
    }
  }

  async googleAuthenticate () {
    return {
      jwt: {
        email: this.storage.email,
        nonce: this.storage.ownerAddress || 'nonce'
      },
      email: this.storage.email,
      address: this.storage.ownerAddress
    }
  }

  // return a structurely-valid JWT (though signature is bogus..)
  _generateMockJwt ({ email, nonce, iat, exp }) {
    const part1 = Buffer.from(JSON.stringify({
      alg: 'RS256',
      kid: '5b5dd9be40b5e1cf121e3573c8e49f12527183d3',
      typ: 'JWT'
    })).toString('base64')
    const aud = ''
    const iss = 'accounts.google.com'
    const part2 = Buffer.from(JSON.stringify(
      { aud, iss, email, email_verified: true, nonce, iat, exp })).toString('base64')
    const part3 = 'SIG'
    return [part1, part2, part3].join('.')
  }

  // return the body of a jwt. signature must exist - but its ignored.
  _parseJwt (jwt) {
    return JSON.parse(Buffer.from(jwt.split('.')[1], 'base64').toString())
  }

  async signOut () {
    this.storage.email = this.storage.ownerAddress = this.storage.privKey = undefined
  }

  async signTransaction ({ tx }) {
    throw new Error('should sign a transaction to be sent')
  }

  async signMessage ({ message, messageHash }) {
    if (!!message === !!messageHash) {
      throw new Error('must specify exactly one of "message" or "messageHash"')
    }
    const hashed = messageHash || ethUtils.keccak(message)
    const hash = ethUtils.hashPersonalMessage(hashed)
    const sig = ethUtils.ecsign(hash, this.storage.privKey)

    return '0x' +
      Buffer.concat([sig.r, sig.s, Buffer.from(String.fromCharCode(sig.v))])
        .toString('hex')
  }
}

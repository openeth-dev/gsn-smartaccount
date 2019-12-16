import AccountApi from '../api/Account.api'

import ethWallet from 'ethereumjs-wallet'
import * as ethUtils from 'ethereumjs-util'
import { buf2hex, hex2buf } from '../utils/utils'

export function storageProps (storage) {
  return new Proxy(storage, {
    get (target, p) { return storage.getItem(p) },
    set (target, p, value) {
      if (value === undefined || value === null) {
        storage.removeItem(p)
      } else {
        if (typeof value !== 'string') {
          throw new Error('Invalid storage value: ' + value)
        }
        storage.setItem(p, value)
      }
      return true
    }
  })
}

export default class Account extends AccountApi {
  // storage - Storage class (setItem,getItem,removeItem - all strings)
  constructor (storage) {
    super()
    if (!storage) {
      throw new Error('missing Storage param')
    }
    this.storage = storageProps(storage)
  }

  async enableApp({appTitle, appUrl}) {
    error( "ask the user to enable the given app/url. once enabled, returns immediately")
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

    this.storage.ownerAddress = buf2hex(wallet.getAddress())
    this.storage.privKey = buf2hex(wallet.privKey)
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
    const aud = '202746986880-u17rbgo95h7ja4fghikietupjknd1bln.apps.googleusercontent.com'
    const azp = aud
    const iss = 'accounts.google.com'
    const part2 = Buffer.from(JSON.stringify(
      { aud, azp, iss, email, email_verified: true, nonce, iat, exp })).toString('base64')
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

  async signMessage (message) {
    return this.signMessageHash(ethUtils.keccak(message))
  }

  async signMessageHash (messageHash) {
    if (typeof messageHash === 'string') {
      messageHash = hex2buf(messageHash)
    }
    const hash = ethUtils.hashPersonalMessage(messageHash)
    const privateKey = hex2buf(this.storage.privKey)
    const sig = ethUtils.ecsign(hash, privateKey)

    return buf2hex(
      Buffer.concat([sig.r, sig.s, Buffer.from([sig.v])])
    )
  }
}

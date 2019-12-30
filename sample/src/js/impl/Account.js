/* global window */
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
  constructor ({ storage, gauth }) {
    super()
    if (!storage) {
      throw new Error('missing Storage param')
    }
    this.storage = storageProps(storage)
    this._loadApprovedApps()

    // must be called very early, since we init with address as nonce.
    if (!this.storage.ownerAddress) {
      this._createOwner()
    }

    this.gauth = gauth
    gauth.init({ nonce: this.storage.ownerAddress })
  }

  _loadApprovedApps () {
    this._approvedApps = JSON.parse(this.storage.approved || '{}')
  }

  _cleanUrl(url) {
    // remove local suffix of URL
    // TODO: do we also remove query params ?
    return url.replace(/#.*/,'')
  }
  _isApproved (url) {
    return this._approvedApps[this._cleanUrl(url)]
  }

  _setApproved (url) {
    this._approvedApps[this._cleanUrl(url)] = true
    this.storage.approved = JSON.stringify(this._approvedApps)
  }

  // called by the AccountFrame, for all calls (except enableApp)
  _verifyApproved (method, url) {
    if (!this._isApproved(url)) {
      throw new Error(method + ': App ' + url + ': not approved')
    }
  }

  async isEnabled ({ appUrl }) {
    return this._isApproved(appUrl)
  }

  async enableApp ({ appTitle, appUrl }) {
    if (this._isApproved(appUrl)) { return }

    if (typeof window === 'undefined') {
      console.log('prompt use to approve appUrl=', appUrl)
    } else if (!window.confirm('Approve connection to\n' + appTitle + '\n' + appUrl)) {
      throw new Error('App ' + appUrl + ': not approved')
    }
    this._setApproved(appUrl)
  }

  async getEmail () {
    return this.storage.email
  }

  _createOwner () {
    if (this.storage.ownerAddress) {
      throw new Error('owner already created')
    }

    const wallet = ethWallet.generate()

    this.storage.ownerAddress = buf2hex(wallet.getAddress())
    this.storage.privKey = buf2hex(wallet.privKey)
  }

  async getOwner () {
    // address allocated early, but returned only after login
    if (!this.storage.email) { return null }
    return this.storage.ownerAddress
  }

  _getPrivKey () {
    return this.storage.privKey
  }

  async googleLogin () {
    if (this.verbose) {
      console.log('open google auth popup. prompt user for google account.\n')
    }

    const info = await this.gauth.signIn({ nonce: this.storage.ownerAddress })
    this.storage.email = info.email
    const ret = {
      email: info.email,
      jwt: info.jwt,
      address: this.storage.ownerAddress
    }
    return ret
  }

  async googleAuthenticate () {
    const info = this.gauth.info()
    return {
      email: info.email,
      jwt: info.jwt,
      address: this.storage.ownerAddress
    }
  }

  // return the body of a jwt. signature must exist - but its ignored.
  _parseJwt (jwt) {
    return JSON.parse(Buffer.from(jwt.split('.')[1], 'base64').toString())
  }

  async signOut () {
    this.storage.email = this.storage.ownerAddress = this.storage.privKey = this.storage.approved = undefined
    await this.gauth.signOut()
    this._loadApprovedApps()
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

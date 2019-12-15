// client-side implementation of account.

import AccountApi from '../api/Account.api'

const verbose = false
const ACCOUNT_FRAME_ID = 'account-frame'

export default class AccountProxy extends AccountApi {
  // storage - property access.
  // localStorage - getItem/setItem (use only if no storage..)
  constructor () {
    super()
    this._initFrame()
    window.addEventListener('message', this._onMessage.bind(this))
    this.idseq = Math.floor(Math.random() * 1e5)
    this.iframe = document.getElementById(ACCOUNT_FRAME_ID).contentWindow
    this.pending = {}
  }

  // create an IFRAME in our window
  _initFrame () {
    console.log('doc=', document)
    const frame = document.createElement('iframe')
    // todo: absolute URL, e.g.: 'https://account.safeaccount.xyz'
    frame.setAttribute('src', 'account.html')
    frame.setAttribute('id', ACCOUNT_FRAME_ID)
    frame.setAttribute('scrolling', 'no')
    frame.style.width = '30px'
    frame.style.height = '30px'
    document.body.appendChild(frame)
  }

  _onMessage ({ source, data }) {
    if (('' + data.source).match(/react/)) { return }
    if (data === 'account-iframe-initialized') {
      this.initialized = true
      console.log('iframe initialized')
      return
    }
    if (!data || !data.id) {
      return
    }
    if (verbose) { console.log('reply src=', source.location.href) }

    const pendingResponse = this.pending[data.id]
    if (!pendingResponse) {
      console.log('ignored unknown message: ', data)
      return
    }
    delete this.pending[data.id]
    pendingResponse(data)
  }

  _call (method, args = {}) {
    const self = this
    if (!this.initialized) {
      if (verbose) {
        console.log('iframe not initialized. ping')
      }
      // iframe not initialized yet. ping it, and wait...
      this.iframe.postMessage('account-iframe-ping', '*')
      // TODO: in case if race-condition with iframe, we always wait 500ms.
      // might be better to "register" for the ping
      setTimeout(() => this._call(method, args), 500)
      return
    }
    return new Promise((resolve, reject) => {
      const id = this.idseq++
      const timeoutId = setTimeout(() => reject(new Error('timed-out: ' + method)), 5000)
      if (verbose) { console.log('calling: ', id, method, args) }
      self.pending[id] = ({ response, error }) => {
        if (verbose) { console.log('response: ', id, method, error || response) }
        clearTimeout(timeoutId)
        if (error) {
          reject(error)
        } else {
          resolve(response)
        }
      }
      this.iframe.postMessage({ method, args, id }, '*')
    })
  }

  async getEmail () {
    return this._call('getEmail')
  }

  async getOwner () {
    return this._call('getOwner')
  }

  async googleLogin () {
    return this._call('googleLogin')
  }

  async googleAuthenticate () {
    return this._call('googleAuthenticate')
  }

  async signOut () {
    return this._call('signOut')
  }

  async signTransaction ({ tx }) {
    return this._call('signTransaction', arguments)
  }

  async signMessage (message) {
    return this._call('signMessage', arguments)
  }

  async signMessageHash (messageHash) {
    return this._call('signMessageHash', arguments)
  }
}

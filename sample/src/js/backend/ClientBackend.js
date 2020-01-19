import axios from 'axios'

import BEapi from '../api/BE.api'

export class Webclient {
  constructor (options) {
    this.provider = axios.create(Object.assign({
      headers: { 'Content-Type': 'application/json' }
    }, options))
  }

  sendPromise (url, jsonRequestData) {
    // console.log('sending request:', url, JSON.stringify(jsonRequestData))
    return this.provider.post(url, jsonRequestData).then(function (response) {
      return response.data
    }).catch(err => Promise.reject(err.response ? err.response.data : { error: err.message }))
  }
}

const jsonrpc = require('jsonrpc-lite')

export default class ClientBackend extends BEapi {
  constructor ({ backendURL }) {
    super()
    this.webclient = new Webclient()
    this.backendURL = backendURL
  }

  async getAddresses () {
    const request = jsonrpc.request(Date.now(), this.getAddresses.name, {})
    return this._sendRequest(request)
  }

  async validatePhone ({ jwt, phoneNumber }) {
    const request = jsonrpc.request(Date.now(), this.validatePhone.name, { jwt, phoneNumber })
    return this._sendRequest(request)
  }

  async getSmartAccountId ({ email }) {
    const request = jsonrpc.request(Date.now(), this.getSmartAccountId.name, { email })
    return this._sendRequest(request)
  }

  async createAccount ({ jwt, smsCode, phoneNumber }) {
    const request = jsonrpc.request(Date.now(), this.createAccount.name, { jwt, smsCode, phoneNumber })
    return this._sendRequest(request)
  }

  async cancelByUrl ({ jwt, url }) {
    const request = jsonrpc.request(Date.now(), this.cancelByUrl.name, { jwt, url })
    return this._sendRequest(request)
  }

  async signInAsNewOperator ({ jwt, title }) {
    const request = jsonrpc.request(Date.now(), this.signInAsNewOperator.name, { jwt, title })
    return this._sendRequest(request)
  }

  async validateAddOperatorNow ({ jwt, smsCode }) {
    const request = jsonrpc.request(Date.now(), this.validateAddOperatorNow.name, { jwt, smsCode })
    return this._sendRequest(request)
  }

  _handleJSONRPCResponse (response) {
    if (response.error) {
      throw new Error(`${response.error.message}. code: ${response.error.code}`)
    }
    return response.result
  }

  async _sendRequest (request) {
    let response = await this.webclient.sendPromise(this.backendURL, request)
    response = this._handleJSONRPCResponse(response)
    return response
  }

  async recoverWallet ({ jwt, title }) {
    const request = jsonrpc.request(Date.now(), this.recoverWallet.name, { jwt, title })
    return this._sendRequest(request)
  }

  async validateRecoverWallet ({ jwt, smsCode }) {
    const request = jsonrpc.request(Date.now(), this.validateRecoverWallet.name, { jwt, smsCode })
    return this._sendRequest(request)
  }
}

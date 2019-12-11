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
    return this.provider.post(url, jsonRequestData)
      .then(function (response) {
        return response.data
      })
      .catch(err => Promise.reject(err.response ? err.response.data : { error: err.message }))
  }
}

const jsonrpc = require('jsonrpc-lite')

export default class ClientBackend extends BEapi {
  constructor ({ serverURL }) {
    super()
    this.webclient = new Webclient()
    this.serverURL = serverURL
  }

  async validatePhone ({ jwt, phoneNumber }) {
    const request = jsonrpc.request(Date.now(), this.validatePhone.name, { jwt, phoneNumber })
    return this._sendRequest(request)
  }

  async createAccount ({ jwt, smsCode, phoneNumber }) {
    const request = jsonrpc.request(Date.now(), this.createAccount.name, { jwt, smsCode, phoneNumber })
    return this._sendRequest(request)
  }

  async addDeviceNow ({ jwt, newaddr }) {
    const request = jsonrpc.request(Date.now(), this.addDeviceNow.name, { jwt, newaddr })
    return this._sendRequest(request)
  }

  handleNotifications () {
    // TODO
  }

  _handleJSONRPCResponse (response) {
    if (response.error) {
      throw new Error(`${response.error.message}. code: ${response.error.code}`)
    }
    return response.result
  }

  async _sendRequest (request) {
    let response = await this.webclient.sendPromise(this.serverURL, request)
    response = this._handleJSONRPCResponse(response)
    return response
  }
}

import BEapi from '../api/BE.api'

const axios = require('axios')

export class Webclient {
  constructor (options) {
    this.provider = axios.create(Object.assign({
      headers: { 'Content-Type': 'application/json' }
    }, options))
  }

  // send (url, jsonRequestData, callback) {
  //   this.sendPromise(url, jsonRequestData || {})
  //     .then(data => callback(null, data))
  //     .catch(err => callback(err, null))
  // }

  sendPromise (url, jsonRequestData) {
    // console.log('sending request:', url, JSON.stringify(jsonRequestData))
    return this.provider.post(url, jsonRequestData)
      .then(function (response) {
        // Promise.resolve()
        return response.data
      })
      .catch(err => Promise.reject(err.response ? err.response.data : { error: err.message }))
  }
}

const jsonrpc = require('jsonrpc-lite')

export class ClientBackend extends BEapi {
  constructor ({ serverURL }) {
    super()
    this.webclient = new Webclient()
    this.serverURL = serverURL
  }

  async validatePhone ({ jwt, phoneNumber }) {
    const request = jsonrpc.request(Date.now(), this.validatePhone.name, { jwt, phoneNumber })
    return this.webclient.sendPromise(this.serverURL + '/' + this.validatePhone.name, request)
  }

  async createAccount ({ jwt, smsCode, phoneNumber }) {
    const request = jsonrpc.request(Date.now(), this.createAccount.name, { jwt, smsCode, phoneNumber })
    return this.webclient.sendPromise(this.serverURL + '/' + this.createAccount.name, request)
  }

  async addDeviceNow ({ jwt, newaddr }) {
    const request = jsonrpc.request(Date.now(), this.addDeviceNow.name, { jwt, newaddr })
    return this.webclient.sendPromise(this.serverURL + '/' + this.addDeviceNow.name, request)
  }

  handleNotifications () {
    // TODO
  }
}

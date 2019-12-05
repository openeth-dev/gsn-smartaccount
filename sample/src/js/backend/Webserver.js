const express = require('express')

export default class Webserver {
  constructor ({ port, be }) {
    // this.server = http.createServer(httpHandler);
    this.port = port
    this.be = be
    this.app = express()
    this.app.get('/validatePhoneHandler', this.validatePhoneHandler())
    this.app.get('/createAccountHandler', this.createAccountHandler())
    this.app.get('/addDeviceNowHandler', this.addDeviceNowHandler())
  }

  start () {
    this.app.listen(this.port, () => {
      console.log('listening on port ', this.port)
    })
  }

  validatePhoneHandler (req, res) {
    this.app.get()
  }

  createAccountHandler (req, res) {
    throw new Error('validate fresh jwt, validate phone (from smsUrl). return approvalData')
  }

  addDeviceNowHandler (req, res) {
    throw new Error('validate jwt, return "click to add" SMS')
  }
}

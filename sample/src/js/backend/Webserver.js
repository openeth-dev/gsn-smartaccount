const express = require('express')
const jsonrpc = require('jsonrpc-lite')
const bodyParser = require('body-parser')

export default class Webserver {
  constructor ({ port, be }) {
    this.port = port
    this.be = be
    this.app = express()
    this.app.use(bodyParser.urlencoded({ extended: false }))
    this.app.use(bodyParser.json())
    console.log('setting handlers')
    this.app.post('/', this.rootHandler.bind(this))
    this.app.post('/validatePhone', this.validatePhoneHandler.bind(this))
    this.app.post('/createAccount', this.createAccountHandler.bind(this))
    this.app.post('/addDeviceNow', this.addDeviceNowHandler.bind(this))
  }

  start () {
    if (!this.serverInstance) {
      this.serverInstance = this.app.listen(this.port, () => {
        console.log('listening on port', this.port)
      })
    }
  }

  stop () {
    return this.serverInstance.close()
  }

  rootHandler (req, res) {
    const success = jsonrpc.success(req.body.id, 'OK')
    res.send(success)
  }

  async validatePhoneHandler (req, res) {
    // console.log('\n\nvalidatePhoneHandler req data:',req.body)
    let status
    try {
      await this.be.validatePhone({ jwt: req.body.params.jwt, phoneNumber: req.body.params.phoneNumber })
      status = jsonrpc.success(req.body.id, 'OK')
    } catch (e) {
      status = jsonrpc.error(req.body.id, new jsonrpc.JsonRpcError(e.toString(), -123))
    }
    res.send(status)
  }

  async createAccountHandler (req, res) {
    let status
    try {
      const approvalData = await this.be.createAccount(
        { jwt: req.body.params.jwt, smsCode: req.body.params.smsCode, phoneNumber: req.body.params.phoneNumber })
      status = jsonrpc.success(req.body.id, approvalData)
    } catch (e) {
      status = jsonrpc.error(req.body.id, new jsonrpc.JsonRpcError(e.toString(), -124))
    }
    res.send(status)
  }

  addDeviceNowHandler (req, res) {
    throw new Error('validate jwt, return "click to add" SMS')
  }
}

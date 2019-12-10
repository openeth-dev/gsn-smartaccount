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

  async rootHandler (req, res) {
    let status
    switch (req.body.method) {
      case this.be.validatePhone.name:
        try {
          await this.be.validatePhone({ jwt: req.body.params.jwt, phoneNumber: req.body.params.phoneNumber })
          status = jsonrpc.success(req.body.id, 'OK')
        } catch (e) {
          status = jsonrpc.error(req.body.id, new jsonrpc.JsonRpcError(e.toString(), -123))
        }
        break
      case this.be.createAccount.name:
        try {
          const approvalData = await this.be.createAccount(
            { jwt: req.body.params.jwt, smsCode: req.body.params.smsCode, phoneNumber: req.body.params.phoneNumber })
          status = jsonrpc.success(req.body.id, approvalData)
        } catch (e) {
          status = jsonrpc.error(req.body.id, new jsonrpc.JsonRpcError(e.toString(), -124))
        }
        break
      case this.be.addDeviceNow.name:
        try {
          // TODO
        } catch (e) {
          status = jsonrpc.error(req.body.id, new jsonrpc.JsonRpcError(e.toString(), -125))
        }
      default:
        status = jsonrpc.error(req.body.id, new jsonrpc.JsonRpcError('Unknown method', -130))
    }
    res.send(status)
  }
}

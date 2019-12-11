import express from 'express'
import jsonrpc from 'jsonrpc-lite'
import bodyParser from 'body-parser'

export default class Webserver {
  constructor ({ port, backend }) {
    this.port = port
    this.backend = backend
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
      case this.backend.validatePhone.name:
        try {
          await this.backend.validatePhone({ jwt: req.body.params.jwt, phoneNumber: req.body.params.phoneNumber })
          status = jsonrpc.success(req.body.id, 'OK')
        } catch (e) {
          status = jsonrpc.error(req.body.id, new jsonrpc.JsonRpcError(e.message, -123))
        }
        break
      case this.backend.createAccount.name:
        try {
          const approvalData = await this.backend.createAccount(
            { jwt: req.body.params.jwt, smsCode: req.body.params.smsCode, phoneNumber: req.body.params.phoneNumber })
          status = jsonrpc.success(req.body.id, approvalData)
        } catch (e) {
          status = jsonrpc.error(req.body.id, new jsonrpc.JsonRpcError(e.message, -124))
        }
        break
      case this.backend.addDeviceNow.name:
        try {
          // TODO
        } catch (e) {
          status = jsonrpc.error(req.body.id, new jsonrpc.JsonRpcError(e.message, -125))
        }
        break
      default:
        status = jsonrpc.error(req.body.id || -1, new jsonrpc.JsonRpcError('Unknown method', -130))
    }
    res.send(status)
  }
}

import express from 'express'
import jsonrpc from 'jsonrpc-lite'
import bodyParser from 'body-parser'
import BEapi from '../api/BE.api'

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
    try {
      if ( !BEapi.prototype[req.body.method] )
        throw new Error( 'no such method: '+req.body.method)

      const func = this.backend[req.body.method]
      const res = await func.apply(this.backend, [req.body.params]) || {}

      status = jsonrpc.success(req.body.id, res)
    } catch (e) {
      status = jsonrpc.error(req.body.id, new jsonrpc.JsonRpcError(e.message, -125))
    }

    res.send(status)
  }
}

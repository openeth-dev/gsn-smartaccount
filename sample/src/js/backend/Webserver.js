import express from 'express'
import jsonrpc from 'jsonrpc-lite'
import bodyParser from 'body-parser'
import BEapi from '../api/BE.api'
import cors from 'cors'

export default class Webserver {
  constructor ({ port, backend, watchdog, admin }) {
    this.port = port
    this.backend = backend
    this.watchdog = watchdog
    this.admin = admin
    this.app = express()
    this.app.use(cors())

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
      if (!BEapi.prototype[req.body.method]) { throw new Error('no such method: ' + req.body.method) }

      let res
      let func
      if ((func = this.backend[req.body.method])) {
        res = await func.apply(this.backend, [req.body.params]) || {}
      } else if ((func = this.watchdog[req.body.method])) {
        res = await func.apply(this.watchdog, [req.body.params]) || {}
      } else if ((func = this.admin[req.body.method])) {
        res = await func.apply(this.admin, [req.body.params]) || {}
      }

      status = jsonrpc.success(req.body.id, res)
    } catch (e) {
      let stack = e.stack.toString()
      // remove anything after 'rootHandler'
      stack = stack.replace(/(rootHandler.*)[\s\S]*/, '$1')
      status = jsonrpc.error(req.body.id, new jsonrpc.JsonRpcError(stack, -125))
    }
    res.send(status)
  }
}

/* global error */

// API for SMS service.
import validate from '../utils/XfaceValidate'
import EventEmitter from 'events'

export default class SMSapi extends EventEmitter {
  constructor () {
    super()
    validate(SMSapi, this)
  }

  sendSms ({ phone, message }) {
    error('send sms to client')
  }
}

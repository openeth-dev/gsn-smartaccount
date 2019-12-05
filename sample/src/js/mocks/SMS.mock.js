/* global */

import SMSapi from '../api/SMS.api'

export default class SMSmock extends SMSapi {
  sendSms ({ phone, message }) {
    this.emit('mocksms', { phone, message })
  }
}

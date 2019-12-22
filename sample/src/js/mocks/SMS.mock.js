/* global */

import SMSapi from '../api/SMS.api'

const fs = require('fs')
const SMS_TMP_FILE_NAME = '/tmp/sms.txt'

export default class SMSmock extends SMSapi {
  constructor (props) {
    super(props)

    // remove sms from previous run..
    if (fs.existsSync(SMS_TMP_FILE_NAME)) {
      fs.unlinkSync(SMS_TMP_FILE_NAME)
    }
  }

  sendSms ({ phone, message }) {
    this.emit('mocksms', { phone, message })
    console.log('sending SMS', phone, message)
    fs.writeFileSync(SMS_TMP_FILE_NAME, JSON.stringify({ phone, message }))
  }

  static readSms () {
    if (!fs.existsSync(SMS_TMP_FILE_NAME)) { return null }
    const val = fs.readFileSync(SMS_TMP_FILE_NAME, { encoding: 'utf8' })
    fs.unlinkSync(SMS_TMP_FILE_NAME)
    if (val == null) return null
    return JSON.parse(val)
  }

  static asyncReadSms (timeout) {
    const interval = 300
    let count = 0
    return new Promise((resolve, reject) => {
      const sms = SMSmock.readSms()
      if (sms) resolve(sms)
      count += interval
      if (count > timeout) {
        reject(Error('timed-out waiting for sms'))
      }

      setTimeout(() => this.asyncReadSms(), interval)
    })
  }
}

/* global */

import SMSapi from '../api/SMS.api'
import twilio from 'twilio'
import fs from 'fs'

export default class SMStwilio extends SMSapi {
  constructor (props) {
    super(props)

    this.config = JSON.parse(fs.readFileSync('twilio.json').toString())
    this.client = twilio(this.config.accountSid, this.config.authToken)
    console.log('using twilio account', this.config.accountSid)
  }

  async sendSms ({ phone, message }) {
    const res = await this.client.messages.create({
      body: message,
      from: this.config.fromNumber,
      to: phone
    })
    console.log('SMS.twilio result: ', res)
  }
}

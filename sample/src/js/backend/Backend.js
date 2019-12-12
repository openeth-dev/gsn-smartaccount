import BEapi from '../api/BE.api'
import { buf2hex } from '../utils/utils'

const phone = require('phone')
const gauth = require('google-auth-library')
const crypto = require('crypto')
const abi = require('ethereumjs-abi')

export class Account {
  constructor ({ email, phone, verificationCode, verified }) {
    Object.assign(this, { email, phone, verificationCode, verified })
  }
}

export class Backend extends BEapi {
  constructor ({ smsProvider, audience, keyManager, factoryAddress, sponsorAddress }) {
    super()
    Object.assign(this, {
      accounts: {},
      smsProvider,
      audience,
      gclient: new gauth.OAuth2Client(audience),
      keyManager,
      factoryAddress,
      sponsorAddress,
      secretSMSCodeSeed: crypto.randomBytes(32)
    })
  }

  async getAddresses () {
    return {
      watchdog: this.keyManager.Address(),
      admin: this.keyManager.Address(),
      factory: this.factoryAddress,
      sponsor: this.sponsorAddress
    }
  }

  async validatePhone ({ jwt, phoneNumber }) {
    const formattedPhone = this._formatPhoneNumber(phoneNumber)
    this._validateJWTFormat(jwt)
    const ticket = await this._verifyJWT(jwt)

    const email = ticket.getPayload().email
    await this._sendSMS({ phoneNumber: formattedPhone, email })
  }

  async createAccount ({ jwt, smsCode, phoneNumber }) {
    const formattedPhone = this._formatPhoneNumber(phoneNumber)
    this._validateJWTFormat(jwt)
    const ticket = await this._verifyJWT(jwt)

    const email = ticket.getPayload().email
    if (this._getSmsCode({ phoneNumber: formattedPhone, email, expectedSmsCode: smsCode }) === smsCode) {
      this.accounts[email] = new Account({
        email: email,
        phone: formattedPhone,
        verificationCode: smsCode,
        verified: true
      })
    } else {
      throw new Error(`invalid sms code: ${smsCode}`)
    }

    const smartAccountId = this._getSmartAccountId(email)
    const approvalData = this._generateApproval({ smartAccountId: smartAccountId })
    return { approvalData: '0x' + approvalData.toString('hex'), smartAccountId: '0x' + smartAccountId.toString('hex') }
  }

  async signInAsNewOperator ({ jwt, title }) {
    throw new Error('validate jwt, return "click to add" SMS')
  }

  async validateAddOperatorNow ({ jwt, url }) {
    throw new Error('validate that addDeviceUrl is the one sent by addOperatorNow. save validation in memory')
  }

  handleNotifications () {
    throw new Error('monitor pending changes. can subscribe for events, but need also to handle due events.')
  }

  /**
   *
   * @param email - user email address type string
   * @returns {Buffer} - keccak256(email) as SmartAccount id, to be verified by SmartAccountFactory on-chain during SmartAccount creation.
   * @private
   */
  async getSmartAccountId ({ email }) {
    return buf2hex(this._getSmartAccountId(email))
  }

  _getSmartAccountId (email) {
    return abi.soliditySHA3(['string'], [email])
  }

  _generateApproval ({ smartAccountId }) {
    const timestamp = Buffer.from(Math.floor(Date.now() / 1000).toString(16), 'hex')
    const hash = abi.soliditySHA3(['bytes32', 'bytes4'], [smartAccountId, timestamp])
    const sig = this.keyManager.ecSignWithPrefix({ hash })
    return abi.rawEncode(['bytes4', 'bytes'], [timestamp, sig])
  }

  async _verifyJWT (jwt) {
    const ticket = await this.gclient.verifyIdToken({
      idToken: jwt,
      audience: this.audience
    })
    return ticket
  }

  _formatPhoneNumber (phoneNumber) {
    const formattedPhone = phone(phoneNumber) // phone("+972 541234567") == [ '+972541234567', 'ISR' ]
    if (formattedPhone.length === 0) {
      throw new Error(`Invalid phone number: ${phoneNumber}`)
    }
    return formattedPhone
  }

  _validateJWTFormat (jwt) {
    let parsed
    try {
      parsed = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64'))
    } catch (e) {
      throw new Error(`invalid jwt: ${jwt}`)
    }
    if (!parsed.aud || parsed.aud !== parsed.azp || this.audience !== parsed.aud) {
      throw new Error('invalid jwt: Invalid azp/aud')
    }
    if (!parsed.email || !parsed.email_verified) {
      throw new Error('invalid jwt: Email not verified')
    }
    return parsed
  }

  async _sendSMS ({ phoneNumber, email }) {
    const code = this._getSmsCode({ phoneNumber, email })
    await this.smsProvider.sendSms({ phone: phoneNumber[0], message: `verification code ${code}` })
    return code
  }

  _getSmsCode ({ phoneNumber, email, expectedSmsCode }) {
    const minuteTimeStamp = this._getMinuteTimestamp({ expectedSmsCode })
    return this._calcSmsCode({ phoneNumber, email, minuteTimeStamp })
  }

  _getMinuteTimestamp ({ expectedSmsCode }) {
    let minuteTimeStamp = Math.floor(Date.now() / 1000 / 60)
    if (expectedSmsCode !== undefined) {
      expectedSmsCode = parseInt(expectedSmsCode)
      const minutes = expectedSmsCode % 10
      minuteTimeStamp = replaceDigits(minuteTimeStamp, minutes, 10)
    }
    return minuteTimeStamp
  }

  _calcSmsCode ({ phoneNumber, email, minuteTimeStamp }) {
    const dataToHash = 'PAD' + this.secretSMSCodeSeed.toString('hex') + phoneNumber[0] + email + minuteTimeStamp + 'PAD'
    let code = parseInt(abi.soliditySHA3(['string'], [dataToHash]).toString('hex').slice(0, 6), 16) % 1e7
    code = code.toString() + (minuteTimeStamp % 10).toString()

    return code
  }
}

function replaceDigits (num, digit, mul = 10) {
  return (num - num % mul + digit - (num % mul >= digit ? 0 : mul))
}

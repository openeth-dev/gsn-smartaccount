import BEapi from '../api/BE.api'

const phone = require('phone')
const gauth = require('google-auth-library')
const crypto = require('crypto')
const abi = require('ethereumjs-abi')
const ethUtils = require('ethereumjs-util')

export class Account {
  constructor ({ email, phone, verificationCode, verified }) {
    Object.assign(this, { email, phone, verificationCode, verified })
  }
}

export class Backend extends BEapi {
  constructor ({ smsProvider, audience, ecdsaKeyPair }) {
    super()
    Object.assign(this, {
      accounts: {},
      smsProvider,
      audience,
      gclient: new gauth.OAuth2Client(audience),
      ecdsaKeyPair,
      secretSMSCodeSeed: crypto.randomBytes(32)
    })
  }

  async validatePhone ({ jwt, phoneNumber }) {
    const p = this._formatPhoneNumber(phoneNumber)
    this._validateJWTFormat(jwt)
    const ticket = await this._verifyJWT(jwt)

    const email = ticket.getPayload().email
    await this._sendSMS({ phoneNumber: p, email })
  }

  async createAccount ({ jwt, smsCode, phoneNumber }) {
    const p = this._formatPhoneNumber(phoneNumber)
    this._validateJWTFormat(jwt)
    const ticket = await this._verifyJWT(jwt)

    const email = ticket.getPayload().email
    if (this._getSmsCode({ phoneNumber: p, email, expectedSmsCode: smsCode }) === smsCode) {
      this.accounts[email] = new Account({ email: email, phone: p, verificationCode: smsCode, verified: true })
    } else {
      throw new Error(`invalid sms code: ${smsCode}`)
    }

    const vaultId = this._getVaultId(email)
    const timestamp = Buffer.from(Math.floor(Date.now() / 1000).toString(16), 'hex')
    const hash = abi.soliditySHA3(['bytes32', 'bytes4'], [vaultId, timestamp])
    const sig = this._ecSignWithPrefix({ hash })
    const approvalData = abi.rawEncode(['bytes4', 'bytes'], [timestamp, sig])
    return approvalData
  }

  async addDeviceNow ({ jwt, newaddr }) {
    throw new Error('validate jwt, return "click to add" SMS')
  }

  handleNotifications () {
    throw new Error('monitor pending changes. can subscribe for events, but need also to handle due events.')
  }

  /**
   *
   * @param email - user email address type string
   * @returns {Buffer} - keccak256(email) as vault id, to be verified by VaultFactory on-chain during vault creation.
   * @private
   */
  _getVaultId (email) {
    return abi.soliditySHA3(['string'], [email])
  }

  async _verifyJWT (jwt) {
    const ticket = await this.gclient.verifyIdToken({
      idToken: jwt,
      audience: this.audience
    })
    return ticket
  }

  _formatPhoneNumber (phoneNumber) {
    const p = phone(phoneNumber) // phone("+972 541234567") == [ '+972541234567', 'ISR' ]
    if (p.length === 0) {
      throw new Error(`Invalid phone number: ${phoneNumber}`)
    }
    return p
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

  _ecSignWithPrefix ({ hash }) {
    const prefixedHash = abi.soliditySHA3(['string', 'bytes32'], ['\x19Ethereum Signed Message:\n32', hash])
    return this._ecSignNoPrefix({ hash: prefixedHash })
  }

  _ecSignNoPrefix ({ hash }) {
    const sig = ethUtils.ecsign(hash, this.ecdsaKeyPair.privateKey)
    return Buffer.concat([sig.r, sig.s, Buffer.from(sig.v.toString(16), 'hex')])
  }
}

function replaceDigits (num, digit, mul = 10) {
  return (num - num % mul + digit - (num % mul >= digit ? 0 : mul))
}

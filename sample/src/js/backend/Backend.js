import { BackendAccount } from './AccountManager'

const phone = require('phone')
const gauth = require('google-auth-library')
const abi = require('ethereumjs-abi')

export class Backend {
  constructor ({ smsManager, audience, keyManager, accountManager }) {
    Object.assign(this, {
      smsManager,
      audience,
      gclient: new gauth.OAuth2Client(audience),
      keyManager,
      accountManager
    })
  }

  async validatePhone ({ jwt, phoneNumber }) {
    const formattedPhone = this._formatPhoneNumber(phoneNumber)
    this._validateJWTFormat(jwt)
    const ticket = await this._verifyJWT(jwt)

    const email = ticket.getPayload().email
    const smsCode = this.smsManager.getSmsCode({ phoneNumber: formattedPhone, email })
    await this.smsManager.sendSMS(
      { phoneNumber: formattedPhone, email, message: `To validate phone and create Account, enter code: ${smsCode}` })
  }

  async createAccount ({ jwt, smsCode, phoneNumber }) {
    const formattedPhone = this._formatPhoneNumber(phoneNumber)
    this._validateJWTFormat(jwt)
    const ticket = await this._verifyJWT(jwt)

    const email = ticket.getPayload().email
    const smartAccountId = await this.getSmartAccountId({ email })
    if (this.smsManager.getSmsCode({ phoneNumber: formattedPhone, email, expectedSmsCode: smsCode }) === smsCode) {
      const newAccount = new BackendAccount({
        accountId: smartAccountId,
        email: email,
        phone: formattedPhone,
        verified: true
      })
      this.accountManager.putAccount({ account: newAccount })
    } else {
      throw new Error(`invalid sms code: ${smsCode}`)
    }

    const approvalData = this._generateApproval({ smartAccountId })
    return { approvalData: '0x' + approvalData.toString('hex'), smartAccountId }
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
   * @returns {string} - keccak256(email) as SmartAccount id, to be verified by SmartAccountFactory on-chain during SmartAccount creation.
   * @private
   */
  async getSmartAccountId ({ email }) {
    return ('0x' + abi.soliditySHA3(['string'], [email]).toString('hex'))
  }

  _generateApproval ({ smartAccountId }) {
    const timestamp = Buffer.from(Math.floor(Date.now() / 1000).toString(16), 'hex')
    const hash = abi.soliditySHA3(['bytes32', 'bytes4'], [Buffer.from(smartAccountId.slice(2), 'hex'), timestamp])
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
      throw new Error(`invalid jwt format: ${jwt}`)
    }
    if (!parsed.aud || parsed.aud !== parsed.azp || this.audience !== parsed.aud) {
      throw new Error('invalid jwt: Invalid azp/aud')
    }
    if (!parsed.email || !parsed.email_verified) {
      throw new Error('invalid jwt: Email not verified')
    }
    return parsed
  }
}

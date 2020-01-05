import { BackendAccount } from './AccountManager'

const phone = require('phone')
const gauth = require('google-auth-library')
const abi = require('ethereumjs-abi')

export class Backend {
  constructor ({ smsManager, audience, keyManager, accountManager, admin }) {
    Object.assign(this, {
      smsManager,
      audience,
      gclient: new gauth.OAuth2Client(audience),
      keyManager,
      accountManager,
      admin
    })
    this.unverifiedNewOperators = {}
  }

  async validatePhone ({ jwt, phoneNumber }) {
    const formattedPhone = this._formatPhoneNumber(phoneNumber)
    const email = (await this._getTicketFromJWT(jwt)).getPayload().email
    const smsCode = this.smsManager.getSmsCode({ phoneNumber: formattedPhone, email })
    await this.smsManager.sendSMS(
      { phoneNumber: formattedPhone, message: `To validate phone and create Account, enter code: ${smsCode}` })
  }

  async createAccount ({ jwt, smsCode, phoneNumber }) {
    const formattedPhone = this._formatPhoneNumber(phoneNumber)
    const email = (await this._getTicketFromJWT(jwt)).getPayload().email
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
    const payload = (await this._getTicketFromJWT(jwt)).getPayload()
    const email = payload.email
    const newOperatorAddress = payload.nonce
    const smartAccountId = await this.getSmartAccountId({ email })
    const account = this.accountManager.getAccountById({ accountId: smartAccountId })
    if (email !== account.email) {
      throw new Error(`Invalid email. from jwt: ${email} from account: ${account.email}`)
    }
    this.unverifiedNewOperators[smartAccountId] = { newOperatorAddress, title }
    const smsCode = this.smsManager.getSmsCode({ phoneNumber: account.phone, email })
    await this.smsManager.sendSMS(
      { phoneNumber: account.phone, message: `To sign-in new device as operator, enter code: ${smsCode}` })
  }

  async _authenticateClient ({ jwt, smsCode }) {
    const email = (await this._getTicketFromJWT(jwt)).getPayload().email
    const accountId = await this.getSmartAccountId({ email })
    const account = this.accountManager.getAccountById({ accountId })
    if (email !== account.email) {
      throw new Error(`Invalid email. from jwt: ${email} from account: ${account.email}`)
    }
    if (this.smsManager.getSmsCode({ phoneNumber: account.phone, email, expectedSmsCode: smsCode }) !== smsCode) {
      throw new Error(`Invalid sms code: ${smsCode}`)
    }
    const { newOperatorAddress, title } = this.unverifiedNewOperators[accountId]
    return { accountId, newOperatorAddress, title }
  }

  async validateAddOperatorNow ({ jwt, smsCode }) {
    const { accountId, newOperatorAddress, title } = await this._authenticateClient({ jwt, smsCode })
    this.accountManager.putOperatorToAdd({ accountId, address: newOperatorAddress })
    delete this.unverifiedNewOperators[accountId]
    return { newOperatorAddress, title }
  }

  async validateRecoverWallet ({ jwt, smsCode }) {
    const { accountId, newOperatorAddress } = await this._authenticateClient({ jwt, smsCode })
    // TODO: schedule add operator config change
    return this.admin.scheduleAddOperator({ accountId, newOperatorAddress })
  }

  async recoverWallet ({ jwt, title }) {
    // TODO: there should be a difference here
    return this.signInAsNewOperator({ jwt, title })
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
    const formattedPhone = phone(phoneNumber) // phone("+972 541234567"), phone("+972541234567") => [ '+972541234567', 'ISR' ]
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

  async _getTicketFromJWT (jwt) {
    this._validateJWTFormat(jwt)
    return this._verifyJWT(jwt)
  }
}

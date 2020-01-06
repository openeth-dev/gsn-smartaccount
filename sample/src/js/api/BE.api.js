/* global error */

// API of the main factory object.
// eslint-disable-next-line no-unused-vars
import validate from '../utils/XfaceValidate'

export default class BEapi {
  constructor () {
    // validate child contract implemented all core functions
    validate(BEapi, this)
  }

  async getAddresses () {
    error('return ethereum addresses of {watchdog,admin,factory,sponsor}')
  }

  async validatePhone ({ jwt, phoneNumber }) {
    error('validate jwt, return SMS url to pass to createSmartAccount')
  }

  async getSmartAccountId ({ email }) {
    error('return the unique ID for the given account')
  }

  async createAccount ({ jwt, smsCode, phoneNumber }) {
    error('validate fresh jwt, validate phone (from smsUrl). return { approvalData, smartAccountId }')
  }

  async signInAsNewOperator ({ jwt, title }) {
    error('validate jwt (contains address in nonce), return "click to add" SMS')
  }

  async validateAddOperatorNow ({ jwt, smsCode }) {
    error('validate that smsCode is the one sent by addOperatorNow. save validation in memory')
  }

  async cancelByUrl ({ jwt, url }) {
    error('send cancel request to watchdog as a response to sms')
  }

  async recoverWallet ({ jwt, title }) {
    error('validate jwt (contains address in nonce), return "click to add" SMS\n' +
      'the difference with signInAsNewOperator is only the method called by backend - applyAdd vs configChange')
  }

  async validateRecoverWallet ({ jwt, smsCode }) {
    error('validate that smsCode is the one sent by recoverWallet. Execute "scheduleAddOperator" on-chain')
  }
}

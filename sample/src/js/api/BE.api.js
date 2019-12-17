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
    error('return ethereum addresses of watchdog,admin,factory')
  }

  async validatePhone ({ jwt, phoneNumber }) {
    error('validate jwt, return SMS url to pass to createSmartAccount')
  }

  async createAccount ({ jwt, smsCode, phoneNumber }) {
    error('validate fresh jwt, validate phone (from smsUrl). return { approvalData, smartAccountId }')
  }

  async addDeviceNow ({ jwt, title }) {
    error('validate jwt (contains address in nonce), return "click to add" SMS')
  }

  async valdiataeAddDevice ({ jwt, addDeviceUrl }) {
    error('validate that addDeviceUrl is the one sent by addDeviceNow. save validation in memory')
  }

  handleNotifications () {
    error('monitor pending changes. can subscribe for events, but need also to handle due events.')
  }
}

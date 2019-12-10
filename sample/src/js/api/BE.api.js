/* global error */

// API of the main factory object.
// eslint-disable-next-line no-unused-vars
import validate from '../utils/XfaceValidate'

export default class BEapi {
  constructor () {
    // validate child contract implemented all core functions
    validate(BEapi, this)
  }

  validatePhone ({ jwt, phone }) {
    error('validate jwt, return SMS url to pass to createVault')
  }

  createAccount ({ jwt, phone, smsVerificationCode }) {
    error('validate fresh jwt, validate phone (from smsUrl). return { approvalData, vaultId }')
  }

  addDeviceNow ({ jwt, newaddr }) {
    error('validate jwt, return "click to add" SMS')
  }

  handleNotifications () {
    error('monitor pending changes. can subscribe for events, but need also to handle due events.')
  }
}

import BEapi from '../js/api/BE.api'

export class BackendMock extends BEapi {
  async getAddresses () {
    return {
      watchdog: '0x5409ed021d9299bf6814279a6a1411a7e866a631',
      admin: '0x5409ed021d9299bf6814279a6a1411a7e866a631',
      factory: '0x5409ed021d9299bf6814279a6a1411a7e866a631',
      sponsor: '0x5409ed021d9299bf6814279a6a1411a7e866a631'
    }
  }

  async validatePhone ({ jwt, phoneNumber }) {
    throw new Error('validate jwt, return SMS url to pass to createSmartAccount')
  }

  async getSmartAccountId ({ email }) {
    throw new Error('return the unique ID for the given account')
  }

  async createAccount ({ jwt, smsCode, phoneNumber }) {
    throw new Error('validate fresh jwt, validate phone (from smsUrl). return { approvalData, smartAccountId }')
  }

  async signInAsNewOperator ({ jwt, title }) {
    throw new Error('validate jwt (contains address in nonce), return "click to add" SMS')
  }

  async validateAddOperatorNow ({ jwt, url }) {
    throw new Error('validate that addDeviceUrl is the one sent by addOperatorNow. save validation in memory')
  }

  handleNotifications () {
    throw new Error('monitor pending changes. can subscribe for events, but need also to handle due events.')
  }
}

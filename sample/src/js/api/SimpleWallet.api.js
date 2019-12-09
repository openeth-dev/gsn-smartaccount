/* global error */
// wallet API.
// This is the template to into actual (and mock) implementation objects.
// (I wish javascript had better "abstract" methods...)

import validate from '../utils/XfaceValidate'
// eslint-disable-next-line no-unused-vars
export default class SimpleWalletApi {
  constructor () {
    validate(SimpleWalletApi, this)
  }

  async initialConfiguration (configuration) {
    error('set initial configuration in the contract')
  }

  transfer ({ destination, amount, token }) {
    error('initiate transfer operation. adds a pending item, depending on transfer policy')
  }

  removeOperator (addr) {
    error('add "remove operator" operation, (delayed, can be canceled by watchdog)')
  }

  cancelPending (id) {
    error('immediately cancel a pending operation (see listPending)')
  }

  refresh () {
    error('refresh state from blockchain: all the ilstXXX operations')
  }

  // whitelist operations
  // TODO: maybe move them to inner "policy-specific" object ?

  transferWhiteList ({ destAddr, amount, token }) {
    error('perform a transfer to a whitelisted address')
  }

  addWhitelist (addrs) {
    error('add pending operation to add entries to whitelist')
  }

  removeWhitelist (addrs) {
    error('remove entries from whitelist (immediate)')
  }

  // return cached list of whitelisted addresses.
  listWhitelistedAddresses () {
    return ['add1', 'add2']
  }

  async getWalletInfo () {
    let addr
    return {
      options: {
        allowAddOperatorNow: false,
        allowAcceleratedCalls: false
      },
      operators: [addr, addr],
      guardians: [
        { addr: 0x123, level: 1, type: 'watchdog' },
        { addr: 0x123, level: 1, type: 'admin' }
      ],
      unknownGuardians: 0,
      levels: [
        {
          delay: '1234',
          requiredApprovals: 2
        },
        {
          delay: '2345',
          requiredApprovals: 0
        }
      ]
    }
  }

  listTokens () {
    error('return static list of {token,balance,decimals} - loaded with refresh()')
  }

  async listPending () {
    error('return pending operations from memory')
  }

  listBypassPolicies () {
    error('return list of pending ops from memory')
  }
}

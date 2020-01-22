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

  async createInitialConfig ({ userConfig }) {
    error('create initial configuration to pass to initialConfiguration')
  }

  async initialConfiguration (configuration) {
    error('set initial configuration in the contract')
  }

  async transfer ({ destination, amount, token }) {
    error('initiate transfer operation. adds a pending item, depending on transfer policy')
  }

  async scheduleBypassCall ({ destination, value, encodedTransaction }) {
    error('initiate operation. adds a pending item.')
  }

  async removeParticipant ({ address, rawPermissions, level }) {
    error('add "remove operator" operation, (delayed, can be canceled by watchdog)')
  }

  async cancelPending (delayedOpId) {
    error('immediately cancel a pending operation (see listPending)')
  }

  refresh () {
    error('refresh state from blockchain: all the ilstXXX operations')
  }

  // whitelist operations
  // TODO: maybe move them to inner "policy-specific" object ?

  transferWhiteList ({ destination, amount, token }) {
    error('perform a transfer to a whitelisted address')
  }

  async setWhitelistedDestination (destination, isWhitelisted) {
    error('add pending operation to add entries to whitelist')
  }

  // return cached list of whitelisted addresses.
  listWhitelistedAddresses () {
    return ['add1', 'add2']
  }

  async isOperator (address) {
    error('return true if the given address is an operator of this wallet')
  }

  async isOperatorOrPending (address) {
    error('return true if the given address is an operator or pending-to-be-operator')
  }

  async subscribe (observer) {
    error('call observer on any blockchain event of this wallet. call getWalletInfo() to update')
  }

  async unsubscribe (observer) {
    error('remove observer from wallet')
  }

  async getWalletInfo () {
    error('wallet info')
  }

  async getWhitelistModule () {
    error('return bypass policy contract object')
  }

  async listTokens () {
    error('return static list of {token,balance,decimals} - loaded with refresh()')
  }

  async listPendingTransactions () {
    error('return pending operations from memory')
  }

  async listPendingConfigChanges () {
    error('return pending operations from memory')
  }

  listBypassPolicies () {
    error('return list of pending ops from memory')
  }

  async addOperatorNow (newOperator) {
    error('initialize add operator flow')
  }

  async validateAddOperatorNow ({ jwt, smsCode }) {
    error('ask backend to add the new device')
  }

  async applyAllPendingOperations () {
    error('apply all')
  }

  async scheduleAddOperator ({ newOperator }) {
    error('schedule add operator')
  }

  async deployWhitelistModule ({ whitelistPreconfigured }) {
    error('deploy a new whitelist module')
  }
}

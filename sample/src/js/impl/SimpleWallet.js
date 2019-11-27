import SampleWalletApi from '../api/SampleWallet.api'

export default class SimpleWallet extends SampleWalletApi {
  constructor (contract) {
    super()
    this.contract = contract
  }

  transfer ({ destAddr, amount, token }) {
  }

  removeOperator (addr) {
  }

  cancelPending (id) {
  }

  refresh () {
  }

  transferWhiteList ({ destAddr, amount, token }) {
  }

  addWhitelist (addrs) {
  }

  removeWhitelist (addrs) {
  }

  // return cached list of whitelisted addresses.
  listWhitelistedAddresses () {
  }

  getWalletInfo () {
  }

  listTokens () {
  }

  listPending () {
  }

  listBypassPolicies () {
  }
}

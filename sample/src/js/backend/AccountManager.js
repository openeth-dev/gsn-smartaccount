export class BackendAccount {
  constructor ({ accountId, email, phone, verified, address }) {
    Object.assign(this, { accountId, email, phone, verified, address })
  }
}

export class AccountManager {
  constructor () {
    this.accounts = {}
    this.addressToId = {}
  }

  putAccount ({ account }) {
    this.accounts[account.accountId] = account
    if (account.address) {
      this.addressToId[account.address] = account.accountId
    }
  }

  getAccountByAddress ({ address }) {
    return this.getAccountById({ accountId: this.addressToId[address] })
  }

  getAccountById ({ accountId }) {
    return this.accounts[accountId]
  }

  removeAccount ({ account }) {
    if (account.address) {
      delete this.addressToId[account.address]
    }
    delete this.accounts[account.accountId]
  }
}

export class Account {
  constructor ({ accountId, email, phone, verified }) {
    Object.assign(this, { accountId, email, phone, verified })
  }
}

export class AccountManager {
  constructor () {
    this.accounts = {}
    this.addressToId = {}
  }

  putAccount ({ account }) {
    this.accounts[account.accountId] = account
  }

  getAccountByAddress ({ address }) {
    return this.getAccountById(this.addressToId[address])
  }

  getAccountById ({ accountId }) {
    return this.accounts[accountId]
  }
}

export class BackendAccount {
  constructor ({ accountId, email, phone, verified, address }) {
    Object.assign(this, { accountId, email, phone, verified, address })
  }
}

export class AccountManager {
  constructor () {
    this.accounts = {}
    this.addressToId = {}
    this.operatorsToAdd = {}
  }

  _toLowerCase ({ account }) {
    account.accountId = account.accountId.toLowerCase()
    if (account.address) {
      account.address = account.address.toLowerCase()
    }
  }

  putAccount ({ account }) {
    if (!account) {
      return
    }
    this._toLowerCase({ account })
    this.accounts[account.accountId] = account
    if (account.address) {
      this.addressToId[account.address] = account.accountId
    }
  }

  getAccountByAddress ({ address }) {
    if (!address) {
      return
    }
    return this.getAccountById({ accountId: this.addressToId[address.toLowerCase()] })
  }

  getAccountById ({ accountId }) {
    if (!accountId) {
      return
    }
    return this.accounts[accountId.toLowerCase()]
  }

  removeAccount ({ account }) {
    if (!account) {
      return
    }
    this._toLowerCase({ account })
    if (account.address) {
      delete this.addressToId[account.address]
    }
    delete this.accounts[account.accountId]
  }

  putOperatorToAdd ({ accountId, address }) {
    if (!accountId || !address) {
      return
    }
    this.operatorsToAdd[accountId.toLowerCase()] = address.toLowerCase()
  }

  getOperatorToAdd ({ accountId }) {
    if (!accountId) {
      return
    }
    return this.operatorsToAdd[accountId.toLowerCase()]
  }

  removeOperatorToAdd ({ accountId }) {
    if (!accountId) {
      return
    }
    delete this.operatorsToAdd[accountId.toLowerCase()]
  }
}

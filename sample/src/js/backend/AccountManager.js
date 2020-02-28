import Nedb from 'nedb-async'

export class BackendAccount {
  constructor ({ accountId, email, phone, address }) {
    Object.assign(this, { accountId, email, phone, address })
  }
}

export class AccountManager {
  constructor ({ workdir = '/tmp/test/' }) {
    this.accounts = new Nedb({ filename: `${workdir}/accounts.db`, autoload: true })
    this.accounts.ensureIndex({ fieldName: 'accountId', unique: true })
    this.accounts.ensureIndex({ fieldName: 'address', unique: true })
    this.accounts.ensureIndex({ fieldName: 'email', unique: true })
    this.operatorsToAdd = new Nedb({ filename: `${workdir}/operatorsToAdd.db`, autoload: true })
    this.operatorsToAdd.ensureIndex({ fieldName: 'address', unique: true })
  }

  _toLowerCase ({ account }) {
    account.accountId = account.accountId.toLowerCase()
    if (account.address) {
      account.address = account.address.toLowerCase()
    }
  }

  async putAccount ({ account }) {
    if (!account) {
      throw new Error('must supply account')
    }
    this._toLowerCase({ account })
    const existing = await this.accounts.asyncFindOne({ accountId: account.accountId })
    if (existing) {
      await this.accounts.asyncUpdate({ accountId: existing.accountId }, { $set: account })
    } else {
      await this.accounts.asyncInsert(account)
    }
  }

  async getAccountByAddress ({ address }) {
    if (!address) {
      throw new Error('must supply address')
    }
    return this.accounts.asyncFindOne({ address: address.toLowerCase() }, { _id: 0 })
  }

  async getAccountById ({ accountId }) {
    if (!accountId) {
      throw new Error('must supply accountId')
    }
    return this.accounts.asyncFindOne({ accountId: accountId.toLowerCase() }, { _id: 0 })
  }

  async removeAccount ({ account }) {
    if (!account) {
      throw new Error('must supply account')
    }
    this._toLowerCase({ account })
    return this.accounts.asyncRemove(account, { multi: true })
  }

  async putOperatorToAdd ({ accountId, address }) {
    if (!accountId || !address) {
      throw new Error('must supply accountId and address')
    }
    const existing = await this.operatorsToAdd.asyncFindOne({ accountId: accountId.toLowerCase() })
    if (existing) {
      return this.operatorsToAdd.asyncUpdate({ accountId: accountId.toLowerCase() },
        { $set: { accountId: accountId.toLowerCase(), address: address.toLowerCase() } })
    } else {
      return this.operatorsToAdd.asyncInsert({ accountId: accountId.toLowerCase(), address: address.toLowerCase() })
    }
  }

  async getOperatorToAdd ({ accountId }) {
    if (!accountId) {
      throw new Error('must supply accountId')
    }
    const opToAdd = await this.operatorsToAdd.asyncFindOne({ accountId: accountId.toLowerCase() }, { _id: 0 })
    if (opToAdd && opToAdd.address) {
      return opToAdd.address
    }
  }

  async removeOperatorToAdd ({ accountId }) {
    if (!accountId) {
      throw new Error('must supply accountId')
    }
    return this.operatorsToAdd.asyncRemove({ accountId: accountId.toLowerCase() })
  }

  async clearAll () {
    await this.accounts.asyncRemove({})
    await this.operatorsToAdd.asyncRemove({})
  }
}

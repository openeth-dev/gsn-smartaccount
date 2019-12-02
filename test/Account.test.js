/* global describe beforeEach it */

import AccountMock from './mocks/Account.mock'

import { assert, expect } from 'chai'

describe('test account mock', () => {
  let acct
  beforeEach('test account', () => {
    acct = new AccountMock()
    acct.signOut()
  })

  it('getEmail', () => {
    assert.equal(acct.getEmail(), null)
    acct.googleLogin()
    assert.equal(acct.getEmail(), 'user@email.com')
  })

  it('createOwner should fail before login', async () => {
    expect(acct.createOwner).to.throw('not logged in')
  })

  it('getOwner after createOwner should return address', async () => {
    assert.equal(acct.getOwner(), null)
    await acct.googleLogin()
    acct.createOwner()
    assert.equal(acct.getOwner(), 'addr')
  })

  it('createOwner should fail if called twice', async () => {
    await acct.googleLogin()
    acct.createOwner()
    expect(acct.createOwner).to.throw('owner already created')
  })
})

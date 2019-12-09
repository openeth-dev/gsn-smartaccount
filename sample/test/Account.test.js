/* global describe beforeEach it */

import AccountMock from '../src/js/mocks/Account.mock'

import chai, { assert } from 'chai'
import chaiAsPromised from 'chai-as-promised'

chai.use(chaiAsPromised)

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

  it('getOwner after login should return address', async () => {
    assert.equal(acct.getOwner(), null)
    await acct.googleLogin()
    assert.equal(acct.getOwner(), 'addr')
  })
})

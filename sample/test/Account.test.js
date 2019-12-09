/* global describe beforeEach it */

import chai, { assert } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import Account from '../src/js/impl/Account.impl'
// import AccountMock from '../src/js/mocks/Account.mock'

chai.use(chaiAsPromised)

describe('Account', () => {
  // created using https://signin.ddns.tabookey.com.s3.eu-west-2.amazonaws.com/index.html#
  const JWT = 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjViNWRkOWJlNDBiNWUxY2YxMjFlMzU3M2M4ZTQ5ZjEyNTI3MTgzZDMiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJhY2NvdW50cy5nb29nbGUuY29tIiwiYXpwIjoiMjAyNzQ2OTg2ODgwLXUxN3JiZ285NWg3amE0ZmdoaWtpZXR1cGprbmQxYmxuLmFwcHMuZ29vZ2xldXNlcmNvbnRlbnQuY29tIiwiYXVkIjoiMjAyNzQ2OTg2ODgwLXUxN3JiZ285NWg3amE0ZmdoaWtpZXR1cGprbmQxYmxuLmFwcHMuZ29vZ2xldXNlcmNvbnRlbnQuY29tIiwic3ViIjoiMTAwNzI5NzUzMTg0NTEzNjQ3MTE1IiwiaGQiOiJ0YWJvb2tleS5jb20iLCJlbWFpbCI6ImRyb3JAdGFib29rZXkuY29tIiwiZW1haWxfdmVyaWZpZWQiOnRydWUsIm5vbmNlIjoiaGVsbG8td29ybGQiLCJpYXQiOjE1NzU4MDY4OTQsImV4cCI6MTU3NTgxMDQ5NCwianRpIjoiNTRhOWNkNDNmNDNhM2I2MjExNGZlNTJiMWY1OGJkMjc1MjQ1MmZiOSJ9.hoyJbGiLwn66wWg_X7-R2XIJip-JzVfs0qRn-V99Z3ffzFlijtECa7Egp4Ganv7nf6Udm_VCUhD3jwUDx2mTZHi-yo0JqFNyhGVbakGIaty9TJIfo9kijFlakzpHtfYyYxnyrKWSiqoULKtvu_NEjKb6QJqSRKZ8ngHholByjyn7cxiIOGJomhGPo7AUSUnPDB5qwzyKz7RuwX3RdccSu2jufCI3_-HWF9yWQOEneJjVwXK3DgOzc_vtJmzuhbJuSIagguvx8TbJVuAnJcBROktEzOoVYcImb-Op5Sshyrt4lIM30WBKgdwGc4LElJJf9tui_FqvBikZRQRUreUpOw'
  let acct
  beforeEach('test account', () => {
    acct = new Account({})
  })

  it('getEmail', () => {
    assert.equal(acct.getEmail(), null)
    acct.googleLogin()
    assert.equal(acct.getEmail(), 'user@email.com')
  })

  it('getOwner after login should return address', async () => {
    await acct.googleLogin()
    assert.match(acct.getOwner(), /^0x\w+$/)
  })

  it('account from storage should have same address/privKey', () => {
    const newacct = new Account({ storage: acct.storage })
    assert.equal(newacct.getOwner(), acct.getOwner())
    // of course, no API to get privkey...
    assert.equal(newacct.storage.privKey, acct.storage.privKey)
  })
  it('account from storage should have same address/privKey after signing',
    async () => {
      const newacct = new Account({ storage: acct.storage })
      assert.equal(newacct.getEmail(), null)
      await newacct.googleLogin()
      assert.match(newacct.getEmail(), /@/)

      assert.equal(newacct.getOwner(), acct.getOwner())
      // of course, no API to get privkey...
      assert.equal(newacct.storage.privKey, acct.storage.privKey)
    })

  it('signout should clear storage', async () => {
    await acct.googleLogin()
    const s = acct.storage
    assert.equal(s.ownerAddress, acct.getOwner())
    assert.match(s.privKey.toString('hex'), /^[0-9a-f]+$/)
    acct.signOut()
    assert.equal(s.ownerAddress, null)
    assert.equal(s.privKey, null)
  })

  it('test parse-jwt', () => {
    const jwt = acct._parseJwt(JWT)
    // eslint-disable-next-line camelcase
    const { email, email_verified, nonce } = jwt
    assert.deepEqual({ email, email_verified, nonce },
      {
        email: 'dror@tabookey.com',
        email_verified: true,
        nonce: 'hello-world'
      }
    )
  })

  // compare to relayClient's getTransactionSignature
  it('sign message', async () => {
    const { getTransactionSignatureWithKey } = require('tabookey-gasless/src/js/relayclient/utils')
    const datahash = require('ethereumjs-util').keccak('hello')
    acct.googleLogin()
    const sig = getTransactionSignatureWithKey(Buffer.from(acct.storage.privKey, 'hex'), '0x' + datahash.toString('hex'))

    assert.equal(await acct.signMessage({ messageHash: datahash }), sig)
    assert.equal(await acct.signMessage({ message: Buffer.from('hello') }), sig)
    assert.equal(await acct.signMessage({ message: 'hello' }), sig)
  })
})

/* global describe beforeEach it */

import chai, { assert } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import Account from '../src/js/impl/Account.impl'
import { MockStorage } from './mocks/MockStorage'
import { getTransactionSignatureWithKey } from 'tabookey-gasless/src/js/relayclient/utils'
import { keccak } from 'ethereumjs-util'

chai.use(chaiAsPromised)

describe('Account', () => {
  // created using https://signin.ddns.tabookey.com.s3.eu-west-2.amazonaws.com/index.html#
  const JWT = 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjViNWRkOWJlNDBiNWUxY2YxMjFlMzU3M2M4ZTQ5ZjEyNTI3MTgzZDMiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJhY2NvdW50cy5nb29nbGUuY29tIiwiYXpwIjoiMjAyNzQ2OTg2ODgwLXUxN3JiZ285NWg3amE0ZmdoaWtpZXR1cGprbmQxYmxuLmFwcHMuZ29vZ2xldXNlcmNvbnRlbnQuY29tIiwiYXVkIjoiMjAyNzQ2OTg2ODgwLXUxN3JiZ285NWg3amE0ZmdoaWtpZXR1cGprbmQxYmxuLmFwcHMuZ29vZ2xldXNlcmNvbnRlbnQuY29tIiwic3ViIjoiMTAwNzI5NzUzMTg0NTEzNjQ3MTE1IiwiaGQiOiJ0YWJvb2tleS5jb20iLCJlbWFpbCI6ImRyb3JAdGFib29rZXkuY29tIiwiZW1haWxfdmVyaWZpZWQiOnRydWUsIm5vbmNlIjoiaGVsbG8td29ybGQiLCJpYXQiOjE1NzU4MDY4OTQsImV4cCI6MTU3NTgxMDQ5NCwianRpIjoiNTRhOWNkNDNmNDNhM2I2MjExNGZlNTJiMWY1OGJkMjc1MjQ1MmZiOSJ9.hoyJbGiLwn66wWg_X7-R2XIJip-JzVfs0qRn-V99Z3ffzFlijtECa7Egp4Ganv7nf6Udm_VCUhD3jwUDx2mTZHi-yo0JqFNyhGVbakGIaty9TJIfo9kijFlakzpHtfYyYxnyrKWSiqoULKtvu_NEjKb6QJqSRKZ8ngHholByjyn7cxiIOGJomhGPo7AUSUnPDB5qwzyKz7RuwX3RdccSu2jufCI3_-HWF9yWQOEneJjVwXK3DgOzc_vtJmzuhbJuSIagguvx8TbJVuAnJcBROktEzOoVYcImb-Op5Sshyrt4lIM30WBKgdwGc4LElJJf9tui_FqvBikZRQRUreUpOw'
  let acct, mockStorage
  beforeEach('test account', () => {
    mockStorage = new MockStorage()
    acct = new Account(mockStorage)
  })

  describe('#getEmail()', async () => {
    it('should be set after googleLogin', async () => {
      assert.equal(await acct.getEmail(), null)
      await acct.googleLogin()
      assert.equal(await acct.getEmail(), 'user@email.com')
    })

    it('should be cleared after signOut', async () => {
      await acct.signOut()
      assert.equal(await acct.getEmail(), null)
    })
  })

  describe('#getOwner()', async () => {
    it('should be set after login', async () => {
      assert.equal(await acct.getOwner(), null)
      await acct.googleLogin()
      assert.match(await acct.getOwner(), /^0x\w+$/)
    })

    it('should be cleared after signOut', async () => {
      await acct.signOut()
      assert.equal(await acct.getOwner(), null)
    })

    it('should return the same value for a new storage', async () => {
      const newacct = new Account(mockStorage)
      assert.equal(await newacct.getOwner(), await acct.getOwner())
      // of course, no API to get privkey...
      assert.equal(newacct.storage.privKey, mockStorage.getItem('privKey'))
    })

    it('should retain the value after re-signin', async () => {
      const newacct = new Account(mockStorage)
      assert.equal(await newacct.getEmail(), null)
      await newacct.googleLogin()
      // just validate it logged in.
      assert.match(await newacct.getEmail(), /@/)

      // ... and kept same address
      assert.equal(await newacct.getOwner(), await acct.getOwner())
      // ... and same privkey
      assert.equal(newacct.storage.privKey, mockStorage.getItem('privKey'))
    })
  })

  it('#_parseJwt()', () => {
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
  it('#signMessage(), signMessageHash', async () => {
    const datahash = keccak('hello')
    await acct.googleLogin()
    const sig = getTransactionSignatureWithKey(
      Buffer.from(acct.storage.privKey, 'hex'), '0x' + datahash.toString('hex'))

    assert.equal(await acct.signMessageHash(datahash), sig)
    assert.equal(await acct.signMessage(Buffer.from('hello')), sig)
    assert.equal(await acct.signMessage('hello'), sig)
  })
})

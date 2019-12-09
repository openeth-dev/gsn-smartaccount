/* global describe beforeEach it */

import AccountMock from '../src/js/mocks/Account.mock'

import chai, { assert, expect } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import Account from '../src/js/impl/Account.impl'
// import AccountMock from '../src/js/mocks/Account.mock'

chai.use(chaiAsPromised)

describe('test account mock', () => {
  // created using https://signin.ddns.tabookey.com.s3.eu-west-2.amazonaws.com/index.html#
  const JWT = 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjViNWRkOWJlNDBiNWUxY2YxMjFlMzU3M2M4ZTQ5ZjEyNTI3MTgzZDMiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJhY2NvdW50cy5nb29nbGUuY29tIiwiYXpwIjoiMjAyNzQ2OTg2ODgwLXUxN3JiZ285NWg3amE0ZmdoaWtpZXR1cGprbmQxYmxuLmFwcHMuZ29vZ2xldXNlcmNvbnRlbnQuY29tIiwiYXVkIjoiMjAyNzQ2OTg2ODgwLXUxN3JiZ285NWg3amE0ZmdoaWtpZXR1cGprbmQxYmxuLmFwcHMuZ29vZ2xldXNlcmNvbnRlbnQuY29tIiwic3ViIjoiMTAwNzI5NzUzMTg0NTEzNjQ3MTE1IiwiaGQiOiJ0YWJvb2tleS5jb20iLCJlbWFpbCI6ImRyb3JAdGFib29rZXkuY29tIiwiZW1haWxfdmVyaWZpZWQiOnRydWUsIm5vbmNlIjoiaGVsbG8td29ybGQiLCJpYXQiOjE1NzU4MDY4OTQsImV4cCI6MTU3NTgxMDQ5NCwianRpIjoiNTRhOWNkNDNmNDNhM2I2MjExNGZlNTJiMWY1OGJkMjc1MjQ1MmZiOSJ9.hoyJbGiLwn66wWg_X7-R2XIJip-JzVfs0qRn-V99Z3ffzFlijtECa7Egp4Ganv7nf6Udm_VCUhD3jwUDx2mTZHi-yo0JqFNyhGVbakGIaty9TJIfo9kijFlakzpHtfYyYxnyrKWSiqoULKtvu_NEjKb6QJqSRKZ8ngHholByjyn7cxiIOGJomhGPo7AUSUnPDB5qwzyKz7RuwX3RdccSu2jufCI3_-HWF9yWQOEneJjVwXK3DgOzc_vtJmzuhbJuSIagguvx8TbJVuAnJcBROktEzOoVYcImb-Op5Sshyrt4lIM30WBKgdwGc4LElJJf9tui_FqvBikZRQRUreUpOw'
  let acct
  beforeEach('test account', () => {
    acct = new Account({})
    acct.signOut()
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
    const addr = acct.getOwner()
    const newacct = new Account({ storage: acct.storage })
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
  function _RelayClient_getTransactionSignatureWithKey (privKey, hash, withPrefix = true) {
    const web3Utils = require('web3-utils')
    const EthCrypto = require('eth-crypto')
    const ethUtils = require('ethereumjs-util')

    const removeHexPrefix = s => s.replace(/^0x/, '')
    let signed
    if (withPrefix) {
      const msg = Buffer.concat([
        Buffer.from('\x19Ethereum Signed Message:\n32'),
        Buffer.from(removeHexPrefix(hash), 'hex')])
      signed = web3Utils.sha3('0x' + msg.toString('hex'))
    } else { signed = hash }
    const keyHex = '0x' + Buffer.from(privKey).toString('hex')
    const sig_ = EthCrypto.sign(keyHex, signed)
    const signature = ethUtils.fromRpcSig(sig_)
    const sig = web3Utils.bytesToHex(signature.r) +
      removeHexPrefix(web3Utils.bytesToHex(signature.s)) +
      removeHexPrefix(web3Utils.toHex(signature.v))

    return sig
  }

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

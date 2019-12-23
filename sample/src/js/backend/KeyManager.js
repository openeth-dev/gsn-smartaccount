import Wallet from 'ethereumjs-wallet'
import { Transaction } from 'ethereumjs-tx'
import abi from 'ethereumjs-abi'

const ethUtils = require('ethereumjs-util')

export class KeyManager {
  constructor ({ ecdsaKeyPair }) {
    this.ecdsaKeyPair = ecdsaKeyPair
  }

  static newKeypair () {
    const a = Wallet.generate()
    return {
      privateKey: a.privKey,
      address: '0x' + a.getAddress().toString('hex')
    }
  }

  ecSignWithPrefix ({ hash }) {
    const prefixedHash = abi.soliditySHA3(['string', 'bytes32'], ['\x19Ethereum Signed Message:\n32', hash])
    return this.ecSignNoPrefix({ hash: prefixedHash })
  }

  ecSignNoPrefix ({ hash }) {
    const sig = ethUtils.ecsign(hash, this.ecdsaKeyPair.privateKey)
    return Buffer.concat([sig.r, sig.s, Buffer.from(sig.v.toString(16), 'hex')])
  }

  address () {
    return this.ecdsaKeyPair.address
  }

  signTransaction ({ to, value, gas, gasPrice, data, nonce }) {
    const tx = new Transaction({
      from: this.address(),
      to,
      value,
      gas,
      gasPrice,
      data,
      nonce
    })
    tx.sign(this.ecdsaKeyPair.privateKey)
    const rawTx = tx.serialize().toString('hex')
    return rawTx
  }
}

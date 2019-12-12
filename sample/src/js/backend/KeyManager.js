const abi = require('ethereumjs-abi')
const ethUtils = require('ethereumjs-util')

export class KeyManager {
  constructor ({ ecdsaKeyPair }) {
    this.ecdsaKeyPair = ecdsaKeyPair
  }

  ecSignWithPrefix ({ hash }) {
    const prefixedHash = abi.soliditySHA3(['string', 'bytes32'], ['\x19Ethereum Signed Message:\n32', hash])
    return this.ecSignNoPrefix({ hash: prefixedHash })
  }

  ecSignNoPrefix ({ hash }) {
    const sig = ethUtils.ecsign(hash, this.ecdsaKeyPair.privateKey)
    return Buffer.concat([sig.r, sig.s, Buffer.from(sig.v.toString(16), 'hex')])
  }

  Address () {
    return this.ecdsaKeyPair.address
  }
}

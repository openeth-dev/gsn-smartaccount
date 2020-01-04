/* global assert */
const ABI = require('ethereumjs-abi')
const ethWallet = require('ethereumjs-wallet')
const ethUtils = require('ethereumjs-util')
module.exports = {

  extractLastConfigPendingEvent: async function (trufflecontract) {
    const pastEvents = await trufflecontract.getPastEvents('ConfigPending', { fromBlock: 'latest' })
    assert.equal(pastEvents.length, 1)
    return pastEvents[0]
  },

  fundSmartAccountWithERC20: async function (destination, erc20, fundedAmount, from) {
    const supply = (await erc20.totalSupply()).toNumber()
    const vaultBalanceBefore = await erc20.balanceOf(destination)
    const account0BalanceBefore = await erc20.balanceOf(from)
    assert.equal(0, vaultBalanceBefore.toNumber())
    assert.equal(supply, account0BalanceBefore.toNumber())

    const res = await erc20.transfer(destination, fundedAmount)

    assert.equal(res.logs[0].event, 'Transfer')
    assert.equal(res.logs[0].args.value, fundedAmount)
    assert.equal(res.logs[0].args.from, from)
    assert.equal(res.logs[0].args.to, destination)

    const vaultBalanceAfter = await erc20.balanceOf(destination)
    const account0BalanceAfter = await erc20.balanceOf(from)
    assert.equal(fundedAmount, vaultBalanceAfter.toNumber())
    assert.equal(supply - fundedAmount, account0BalanceAfter.toNumber())
  },

  forgeApprovalData: async function (smartAccountId, smartAccountFactory, vfOwner) {
    const timestamp = Buffer.from(Math.floor(Date.now() / 1000).toString(16), 'hex')// 1575229433
    const keyPair = module.exports.newEphemeralKeypair()

    let hash = ABI.soliditySHA3(['bytes32', 'bytes4'], [smartAccountId, timestamp])
    hash = ABI.soliditySHA3(['string', 'bytes32'], ['\x19Ethereum Signed Message:\n32', hash])
    const sig = ethUtils.ecsign(hash, keyPair.privateKey)
    const backendSignature = Buffer.concat([sig.r, sig.s, Buffer.from(sig.v.toString(16), 'hex')])
    // Adding mocked signer as trusted caller i.e. backend ethereum address
    const signer = keyPair.address
    await smartAccountFactory.addTrustedSigners([signer], { from: vfOwner })
    const approvalData = ABI.rawEncode(['bytes4', 'bytes'], [timestamp, backendSignature])

    return approvalData
  },

  newEphemeralKeypair: function () {
    const a = ethWallet.generate()
    return {
      privateKey: a.privKey,
      address: '0x' + a.getAddress().toString('hex')
    }
  },

  snapshot: function (web3) {
    return new Promise((resolve, reject) => {
      web3.currentProvider.send({
        jsonrpc: '2.0',
        method: 'evm_snapshot',
        id: Date.now()
      }, (err, snapshotId) => {
        if (err) { return reject(err) }
        return resolve(snapshotId)
      })
    })
  },

  revert: function (id, web3) {
    return new Promise((resolve, reject) => {
      web3.currentProvider.send({
        jsonrpc: '2.0',
        method: 'evm_revert',
        params: [id],
        id: Date.now()
      }, (err, result) => {
        if (err) { return reject(err) }
        return resolve(result)
      })
    })
  },

  increaseTime: function (time, web3) {
    return new Promise((resolve, reject) => {
      web3.currentProvider.send({
        jsonrpc: '2.0',
        method: 'evm_increaseTime',
        params: [time],
        id: Date.now()
      }, (err) => {
        if (err) return reject(err)
        module.exports.evmMine(web3)
          .then(r => resolve(r))
          .catch(e => reject(e))
      })
    })
  },

  evmMine: function (web3) {
    return new Promise((resolve, reject) => {
      web3.currentProvider.send({
        jsonrpc: '2.0',
        method: 'evm_mine',
        params: [],
        id: Date.now()
      }, (e, r) => {
        if (e) reject(e)
        else resolve(r)
      })
    })
  },

  getBalance: function (web3, token, address) {
    if (!token) {
      return web3.eth.getBalance(address)
    } else {
      return token.balanceOf(address)
    }
  }
}

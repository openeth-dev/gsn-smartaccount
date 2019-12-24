/* npm modules */
const ABI = require('ethereumjs-abi')
const Web3Utils = require('web3-utils')
const EthUtils = require('ethereumjs-util')
const assert = require('chai').assert

module.exports = {

  removeHexPrefix: function (hex) {
    return hex.replace(/^0x/, '')
  },

  bufferToHex: function (buffer) {
    return '0x' + buffer.toString('hex')
  },

  participantHash: function (admin, permLevel) {
    return ABI.soliditySHA3(['address', 'uint32'], [admin, permLevel])
  },

  // TODO: fix this mess, Alex!
  participantHashUnpacked: function (admin, perms, level) {
    return this.participantHash(admin, this.packPermissionLevel(perms, level))
  },

  bypassCallHash: function (stateNonce, sender, senderPermsLevel, target, value, msgdata) {
    assert.equal(typeof msgdata, 'string')
    const calldataBuffer = Buffer.from(this.removeHexPrefix(msgdata), 'hex')
    return ABI.soliditySHA3(['uint256', 'address', 'uint32', 'address', 'uint256', 'bytes'], [stateNonce, sender, senderPermsLevel, target, value, calldataBuffer])
  },

  // Only used in tests
  validateConfigParticipants: async function (participants, gatekeeper) {
    await this.asyncForEach(participants, async (participant) => {
      const adminHash = this.bufferToHex(this.participantHash(participant.address, participant.permLevel))
      const isAdmin = await gatekeeper.participants(adminHash)
      assert.equal(participant.isParticipant, isAdmin, `admin ${participant.name} isAdmin=${isAdmin}, expected=${participant.isParticipant}`)
    })
  },

  validateConfigDelays: async function (delays, gatekeeper) {
    const onchainDelays = await gatekeeper.getDelays()
    for (let i = 0; i < delays.length; i++) {
      assert.equal(onchainDelays[i], delays[i])
    }
  },
  validateConfigApprovalsPerLevel: async function (approvalsPerLevel, gatekeeper) {
    const onchainApprovals = await gatekeeper.getApprovalsPerLevel()
    for (let i = 0; i < approvalsPerLevel.length; i++) {
      assert.equal(onchainApprovals[i], approvalsPerLevel[i])
    }
  },

  packPermissionLevel (permissions, level) {
    const permInt = parseInt(permissions)
    const levelInt = parseInt(level)

    assert.isAtMost(permInt, 0x07FFFFFF)
    assert.isAtMost(levelInt, 0x1F)
    return '0x' + ((levelInt << 27) + permInt).toString(16)
  },

  // Only used in tests
  asyncForEach: async function (array, callback) {
    for (let index = 0; index < array.length; index++) {
      await callback(array[index], index, array)
    }
  },

  async signMessage (hash, web3, { from }) {
    let sig_
    try {
      sig_ = await new Promise((resolve, reject) => {
        try {
          web3.eth.personal.sign(hash, from, (err, res) => {
            if (err) reject(err)
            else resolve(res)
          })
        } catch (e) {
          reject(e)
        }
      })
    } catch (e) {
      sig_ = await new Promise((resolve, reject) => {
        web3.eth.sign(hash, from, (err, res) => {
          if (err) reject(err)
          else resolve(res)
        })
      })
    }

    const signature = EthUtils.fromRpcSig(sig_)
    // noinspection UnnecessaryLocalVariableJS
    const sig = Web3Utils.bytesToHex(signature.r) + this.removeHexPrefix(Web3Utils.bytesToHex(signature.s)) + this.removeHexPrefix(Web3Utils.toHex(signature.v))
    return sig
  }
}

const ABI = require('ethereumjs-abi');
const Web3Utils = require('web3-utils');
const EthUtils = require('ethereumjs-util');
const assert = require('chai').assert;


function removeHexPrefix(hex) {
    return hex.replace(/^0x/, '');
}

module.exports = {

    // Only used in tests
    increaseTime: function (time, web3) {
        return new Promise((resolve, reject) => {
            web3.currentProvider.send({
                jsonrpc: '2.0',
                method: 'evm_increaseTime',
                params: [time],
                id: new Date().getSeconds()
            }, (err) => {
                if (err) return reject(err);
                module.exports.evmMine(web3)
                    .then(r => resolve(r))
                    .catch(e => reject(e))

            });
        })
    },

    // Only used in tests
    evmMine: function (web3) {
        return new Promise((resolve, reject) => {
            web3.currentProvider.send({
                jsonrpc: '2.0',
                method: 'evm_mine',
                params: [],
                id: new Date().getSeconds()
            }, (e, r) => {
                if (e) reject(e);
                else resolve(r)
            });

        })
    },

    encodePackedBatch: function (encodedCalls) {
        let types = [];
        let values = [];
        for (let i = 0; i < encodedCalls.length; i++) {
            let encodedBuffer = Buffer.from(encodedCalls[i].slice(2), "hex");
            let encodedCallLengts = encodedBuffer.length;
            types = types.concat(["uint256", "bytes"]);
            values = values.concat([encodedCallLengts, encodedBuffer]);
        }
        return ABI.solidityPack(types, values);
    },

    bufferToHex: function (buffer) {
        return "0x" + buffer.toString("hex");
    },

    delayedOpHash: function (batchMetadata, nonce, batch) {
        return ABI.soliditySHA3(["bytes", "uint256", "bytes"], [batchMetadata, nonce, batch])
    },

    participantHash: function (admin, permLevel) {
        return ABI.soliditySHA3(["address", "uint16"], [admin, permLevel])
    },

    // Only used in tests
    validateConfigParticipants: async function (participants, gatekeeper) {
        await this.asyncForEach(participants, async (participant) => {
            let adminHash = this.bufferToHex(this.participantHash(participant.address, participant.permLevel));
            let isAdmin = await gatekeeper.participants(adminHash);
            assert.equal(participant.isParticipant, isAdmin, `admin ${participant.name} isAdmin=${isAdmin}, expected=${participant.isParticipant}`);
        });
    },

    validateConfigDelays: async function (delays, gatekeeper) {
        let onchainDelays = await gatekeeper.getDelays();
        for (let i = 0; i < delays.length; i++) {
            assert.equal(onchainDelays[i],delays[i]);
        }
    },

    packPermissionLevel(permissions, level) {
        let permInt = parseInt(permissions);
        let levelInt = parseInt(level);

        assert.isAtMost(permInt, 0x07FF);
        assert.isAtMost(levelInt, 0x1F);
        return "0x" + ((levelInt << 11) + permInt).toString(16);
    },

    // Only used in tests
    asyncForEach: async function (array, callback) {
        for (let index = 0; index < array.length; index++) {
            await callback(array[index], index, array);
        }
    },

    getTransactionHash(txBuffer) {
        return Web3Utils.sha3('0x' + txBuffer.toString("hex"))
    },

    async signMessage(hash, web3, {from}) {
        let sig_;
        try {
            sig_ = await new Promise((resolve, reject) => {
                try {
                    web3.eth.personal.sign(hash, from, (err, res) => {
                        if (err) reject(err);
                        else resolve(res)
                    })
                } catch (e) {
                    reject(e)
                }
            })

        } catch (e) {
            sig_ = await new Promise((resolve, reject) => {
                web3.eth.sign(hash, from, (err, res) => {
                    if (err) reject(err);
                    else resolve(res)
                })
            })
        }

        let signature = EthUtils.fromRpcSig(sig_);
        // noinspection UnnecessaryLocalVariableJS
        let sig = Web3Utils.bytesToHex(signature.r) + removeHexPrefix(Web3Utils.bytesToHex(signature.s)) + removeHexPrefix(Web3Utils.toHex(signature.v));
        return sig;
    }
};
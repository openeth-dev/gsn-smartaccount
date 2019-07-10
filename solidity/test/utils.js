const ABI = require('ethereumjs-abi');
const Web3Utils = require('web3-utils');
const EthUtils = require('ethereumjs-util');

function removeHexPrefix(hex) {
    return hex.replace(/^0x/, '');
}

module.exports = {

    increaseTime: function (time) {
        return new Promise((resolve, reject) => {
            web3.currentProvider.send({
                jsonrpc: '2.0',
                method: 'evm_increaseTime',
                params: [time],
                id: new Date().getSeconds()
            }, (err) => {
                if (err) return reject(err)
                module.exports.evmMine()
                    .then(r => resolve(r))
                    .catch(e => reject(e))

            });
        })
    },

    evmMine: function () {
        return new Promise((resolve, reject) => {
            web3.currentProvider.send({
                jsonrpc: '2.0',
                method: 'evm_mine',
                params: [],
                id: new Date().getSeconds()
            }, (e, r) => {
                if (e) reject(e)
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

    delayedOpHash: function (sender, extraData, nonce, batch) {
        return ABI.soliditySHA3(["address", "uint256", "uint256", "bytes"], [sender, extraData, nonce, batch])
    },

    participantHash: function (admin, permLevel) {
        return ABI.soliditySHA3(["address", "uint16"], [admin, permLevel])
    },

    extractLastDelayedOpsEvent: async function (trufflecontract) {
        let pastEvents = await trufflecontract.getPastEvents("DelayedOperation", {fromBlock: "latest"});
        assert.equal(pastEvents.length, 1);
        return pastEvents[0];
    },

    asyncForEach: async function (array, callback) {
        for (let index = 0; index < array.length; index++) {
            await callback(array[index], index, array);
        }
    },

    // TODO: accept 1 array of objects, not 3 arrays of primitives.
    validateConfig: async function (participants, gatekeeper) {
        await this.asyncForEach(participants, async (participant) => {
            let adminHash = this.bufferToHex(this.participantHash(participant.address, participant.permLevel));
            let isAdmin = await gatekeeper.participants(adminHash);
            assert.equal(participant.isParticipant, isAdmin, `admin ${participant.name} isAdmin=${isAdmin}, expected=${participant.isParticipant}`);
        });
    },

    packPermissionLevel(permissions, level) {
        let permInt = parseInt(permissions);
        let levelInt = parseInt(level);

        assert.isAtMost(permInt, 0x07FF);
        assert.isAtMost(levelInt, 0x1F);
        return "0x" + ((levelInt << 11) + permInt).toString(16);
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
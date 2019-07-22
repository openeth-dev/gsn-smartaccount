const ABI = require('ethereumjs-abi');
const assert = require('chai').assert;

module.exports = {

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

    asyncForEach: async function (array, callback) {
        for (let index = 0; index < array.length; index++) {
            await callback(array[index], index, array);
        }
    }
};
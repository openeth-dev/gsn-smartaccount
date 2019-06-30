const ABI = require('ethereumjs-abi');

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

    participantHash: function (admin, permissions, level) {
        return ABI.soliditySHA3(["address", "uint16", "uint8"], [admin, permissions, level])
    },

    extractLastDelayedOpsEvent: async function (trufflecontract) {
        let pastEvents = await trufflecontract.getPastEvents("DelayedOperation", {fromBlock: "latest"});
        assert.equal(pastEvents.length, 1);
        return pastEvents[0];
    },

    validateAdminsConfig: async function (admins, levels, expected, gatekeeper, permissions) {
        assert.equal(admins.length, levels.length);
        assert.equal(expected.length, levels.length);
        if (permissions === undefined) {
            permissions = Array(expected.length).fill("0x270");
        }
        assert.equal(expected.length, levels.length);
        for (let i = 0; i < admins.length; i++) {
            let adminHash = this.bufferToHex(this.participantHash(admins[i], permissions[i], levels[i]));
            let isAdmin = await gatekeeper.participants(adminHash);
            assert.equal(expected[i], isAdmin, `admin №${i} isAdmin=${isAdmin}, expected=${expected[i]}`);
        }
    }
};
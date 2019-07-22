const Web3Utils = require('web3-utils');
const EthUtils = require('ethereumjs-util');


function removeHexPrefix(hex) {
    return hex.replace(/^0x/, '');
}


// TODO: some of these mothods are used outside of tests, and in 'js_foundation' project
//  create a 'shared' js module for those
module.exports = {

    extractLastDelayedOpsEvent: async function (trufflecontract) {
        let pastEvents = await trufflecontract.getPastEvents("DelayedOperation", {fromBlock: "latest"});
        assert.equal(pastEvents.length, 1);
        return pastEvents[0];
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
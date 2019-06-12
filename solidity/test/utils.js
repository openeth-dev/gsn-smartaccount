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
};
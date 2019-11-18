module.exports = {

    extractLastConfigPendingEvent: async function (trufflecontract) {
        let pastEvents = await trufflecontract.getPastEvents("ConfigPending", {fromBlock: "latest"});
        assert.equal(pastEvents.length, 1);
        return pastEvents[0];
    },

    fundVaultWithERC20: async function (destination, erc20, fundedAmount, from) {
        let supply = (await erc20.totalSupply()).toNumber();
        let vaultBalanceBefore = await erc20.balanceOf(destination);
        let account0BalanceBefore = await erc20.balanceOf(from);
        assert.equal(0, vaultBalanceBefore.toNumber());
        assert.equal(supply, account0BalanceBefore.toNumber());

        let res = await erc20.transfer(destination, fundedAmount);

        assert.equal(res.logs[0].event, "Transfer");
        assert.equal(res.logs[0].args.value, fundedAmount);
        assert.equal(res.logs[0].args.from, from);
        assert.equal(res.logs[0].args.to, destination);

        let vaultBalanceAfter = await erc20.balanceOf(destination);
        let account0BalanceAfter = await erc20.balanceOf(from);
        assert.equal(fundedAmount, vaultBalanceAfter.toNumber());
        assert.equal(supply - fundedAmount, account0BalanceAfter.toNumber())
    }
};

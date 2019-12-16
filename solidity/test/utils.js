/* global assert */
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
  }
}

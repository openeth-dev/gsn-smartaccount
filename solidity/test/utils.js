module.exports = {

    extractLastDelayedOpsEvent: async function (trufflecontract) {
        let pastEvents = await trufflecontract.getPastEvents("DelayedOperation", {fromBlock: "latest"});
        assert.equal(pastEvents.length, 1);
        return pastEvents[0];
    }
};
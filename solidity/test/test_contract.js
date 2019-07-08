var Contract = artifacts.require("./Contract.sol");

contract('Contract', function (accounts) {

    it("should work", async function () {
    	let contract = await Contract.deployed()
    	let res = await contract.emitMessage("Hello", 1)
        let event = res.logs[0];

        assert.equal(event.args.message,"Hello")
        assert.equal(event.args.value, 1)

    	let res2 = await contract.getData()
        assert.equal(res2["0"],2)
        assert.equal(res2["1"], 3)
    });

    after("write coverage report", async () => {
        await global.postCoverage()
    });
});

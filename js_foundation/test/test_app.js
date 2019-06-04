var Contract = artifacts.require("./Contract.sol");
var App = require("../src/js/index.js")

contract('App', function (accounts) {

    it("should work", async function () {
    	let contract = await Contract.deployed()
    	let app = new App(contract.address, "0xe4bc4dcd6655eaec6387cf221623237518f35dd5")
    	let res = await app.emitMessage("Hello", 1)
        let event = res.events.ContractEmitted;

        assert.equal(event.returnValues["0"],"Hello")
        assert.equal(event.returnValues["1"], 1)
/*
        assert.equal(res.logs[0].event, "ContractEmitted")
        assert.equal(res.logs[0].args.message, "Hello")
        assert.equal(res.logs[0].args.value, 1)
*/
    	let res2 = await app.getData()
        assert.equal(res2["0"],2)
        assert.equal(res2["1"], 3)
    });

});
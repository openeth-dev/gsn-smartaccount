var App = require("../src/js/index.js");

context('App', function () {
    let ethNodeUrl = 'http://localhost:8545';

    it("should work", async function () {
        let a = new App(ethNodeUrl);
        await a.deployNewGatekeeper();
    });

});
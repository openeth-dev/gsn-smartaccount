const VaultFactory = artifacts.require("./VaultFactory.sol");
const Gatekeeper = artifacts.require("./Gatekeeper.sol");
const Utilities = artifacts.require("./Utilities.sol");


module.exports = async function (deployer) {
    await deployer.deploy(Utilities);
    deployer.link(Utilities, VaultFactory);
    deployer.link(Utilities, Gatekeeper);
    await deployer.deploy(VaultFactory, {gas: 80000000});
    // I think there is a bug in truffle, trying to deploy Gatekeeper first causes an error for no reason
    console.log("Deploying Gatekeeper");
    let gatekeeper = await deployer.deploy(Gatekeeper, {gas: 80000000});
    console.log("Gatekeeper", Gatekeeper.address);
};
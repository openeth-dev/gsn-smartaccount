const VaultFactory = artifacts.require("./VaultFactory.sol");
const Gatekeeper = artifacts.require("./Gatekeeper.sol");
const Utilities = artifacts.require("./Utilities.sol");
const RelayHub = artifacts.require("RelayHub");


module.exports = async function (deployer) {
    await deployer.deploy(Utilities);
    deployer.link(Utilities, VaultFactory);
    await deployer.deploy(RelayHub);
    deployer.link(Utilities, Gatekeeper);
    let zeroAddress = "0x0000000000000000000000000000000000000000";
    await deployer.deploy(VaultFactory, zeroAddress, zeroAddress);
    // I think there is a bug in truffle, trying to deploy Gatekeeper first causes an error for no reason
    // console.log("Deploying Gatekeeper");

    let gatekeeper = await deployer.deploy(Gatekeeper, zeroAddress, zeroAddress);
    // console.log("Gatekeeper", Gatekeeper.address);
};

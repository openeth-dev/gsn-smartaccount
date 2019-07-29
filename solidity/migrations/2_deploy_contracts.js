const Vault = artifacts.require("./Vault.sol");
const VaultFactory = artifacts.require("./VaultFactory.sol");
const Gatekeeper = artifacts.require("./Gatekeeper.sol");


module.exports = async function (deployer) {
    await deployer.deploy(VaultFactory, {gas: 8000000});
    // I think there is a bug in truffle, trying to deploy Gatekeeper first causes an error for no reason
    console.log("Deploying Gatekeeper");
    let gatekeeper = await deployer.deploy(Gatekeeper);
    console.log("Gatekeeper", Gatekeeper.address);
    console.log("Deploying Vault");
    await deployer.deploy(Vault, gatekeeper.address);
    console.log("Vault", Vault.address);
};
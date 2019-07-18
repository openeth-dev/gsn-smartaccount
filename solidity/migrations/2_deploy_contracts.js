const Contract = artifacts.require("./Contract.sol");
const Vault = artifacts.require("./Vault.sol");
const VaultFactory = artifacts.require("./VaultFactory.sol");
const Gatekeeper = artifacts.require("./Gatekeeper.sol");


module.exports = async function (deployer) {
    await deployer.deploy(Contract);
    console.log("Deploying Gatekeeper");
    let gatekeeper = await deployer.deploy(Gatekeeper);
    console.log("Deploying Vault");
    await deployer.deploy(Vault, gatekeeper.address);
    await deployer.deploy(VaultFactory);
};
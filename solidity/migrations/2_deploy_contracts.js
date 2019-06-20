const Contract = artifacts.require("./Contract.sol");
const Vault = artifacts.require("./Vault.sol");
const Gatekeeper = artifacts.require("./Gatekeeper.sol");


module.exports = async function(deployer) {
	await deployer.deploy(Contract);
	await deployer.deploy(Gatekeeper);
	await deployer.deploy(Vault);
};
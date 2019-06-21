const Contract = artifacts.require("./Contract.sol");
const Vault = artifacts.require("./Vault.sol");
const Gatekeeper = artifacts.require("./Gatekeeper.sol");


module.exports = async function(deployer) {
	await deployer.deploy(Contract);
	console.log("Deploying Gatekeeper");
	await deployer.deploy(Gatekeeper);
	console.log("Deploying Vault");
	await deployer.deploy(Vault);
};
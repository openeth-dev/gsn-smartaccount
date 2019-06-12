var Contract = artifacts.require("./Contract.sol");
var Vault = artifacts.require("./Vault.sol");


module.exports = function(deployer) {
	deployer.deploy(Contract);
	deployer.deploy(Vault);
}
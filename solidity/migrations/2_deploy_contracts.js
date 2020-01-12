/* global artifacts */
const SmartAccountFactory = artifacts.require('./SmartAccountFactory.sol')
const Gatekeeper = artifacts.require('./SmartAccount.sol')
const Utilities = artifacts.require('./Utilities.sol')
const RelayHub = artifacts.require('RelayHub')

module.exports = async function (deployer) {
  await deployer.deploy(Utilities)
  deployer.link(Utilities, SmartAccountFactory)
  await deployer.deploy(RelayHub)
  deployer.link(Utilities, Gatekeeper)
  const zeroAddress = '0x0000000000000000000000000000000000000000'
  await deployer.deploy(Gatekeeper, { gas: 8e6 })
  console.log( "deployed GK address=", Gatekeeper.address)
  await deployer.deploy(SmartAccountFactory, zeroAddress, { gas: 9e7 })
    .then(factory => factory.createAccountTemplate(Gatekeeper.address))

  // I think there is a bug in truffle, trying to deploy Gatekeeper first causes an error for no reason
  // console.log("Deploying Gatekeeper");
  // const gatekeeper =
  // console.log("Gatekeeper ", Gatekeeper.address);
}

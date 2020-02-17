/* global artifacts */
const SmartAccountFactory = artifacts.require('./SmartAccountFactory.sol')
const BypassLib = artifacts.require('./BypassModules/BypassLib.sol')
const SmartAccount = artifacts.require('./SmartAccount.sol')
const Gatekeeper = artifacts.require('./SmartAccount.sol')
const Utilities = artifacts.require('./Utilities.sol')
const RelayHub = artifacts.require('RelayHub')

module.exports = async function (deployer) {
  await deployer.deploy(Utilities)
  deployer.link(Utilities, SmartAccountFactory)
  await deployer.deploy(RelayHub)
  deployer.link(Utilities, Gatekeeper)
  deployer.link(Utilities, BypassLib)
  const zeroAddress = '0x0000000000000000000000000000000000000000'
  const bypassLib = await deployer.deploy(BypassLib, { gas: 8e6 })
  await deployer.deploy(SmartAccount, bypassLib.address, { gas: 9e6 }).then(smartAccount =>
        deployer.deploy(SmartAccountFactory, zeroAddress, smartAccount.address, bypassLib.address, { gas: 9e7 })
  )

  // I think there is a bug in truffle, trying to deploy Gatekeeper first causes an error for no reason
  // console.log("Deploying Gatekeeper");
  // const gatekeeper =
  await deployer.deploy(Gatekeeper, bypassLib.address, { gas: 8e6 })
  // console.log("Gatekeeper ", Gatekeeper.address);
}

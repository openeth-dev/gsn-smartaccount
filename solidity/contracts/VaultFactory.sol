pragma solidity ^0.5.10;

import "./Gatekeeper.sol";

contract VaultFactory is GsnRecipient {

    constructor(address _forwarder, address _hub) public {
        setGsnForwarder(_forwarder, _hub);
    }

    function _acceptCall(
        address from,
        bytes memory encodedFunction)
    view internal returns (uint256 res, bytes memory data){
        return (0, "");
    }

    event VaultCreated(address sender, Gatekeeper gatekeeper);

    function newVault() public {
        Gatekeeper gatekeeper = new Gatekeeper(gsnForwarder, relayHub);
        emit VaultCreated(getSender(), gatekeeper);
    }
}

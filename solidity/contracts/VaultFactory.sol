pragma solidity ^0.5.10;

import "./Gatekeeper.sol";

contract VaultFactory is GsnRecipient {

    constructor(address _forwarder) public {
        setGsnForwarder(_forwarder);
    }

    function _acceptCall(
        address from,
        bytes memory encodedFunction)
    view internal returns (uint256 res, bytes memory data){

        (from,encodedFunction);
        return (0, "");
    }

    event VaultCreated(address sender, Gatekeeper gatekeeper);

    function newVault() public {
        Gatekeeper gatekeeper = new Gatekeeper(this.getGsnForwarder(), getSender());
        emit VaultCreated(getSender(), gatekeeper);
    }
}

pragma solidity ^0.5.10;

import "gsn-sponsor/contracts/GsnRecipient.sol";

import "./WhitelistBypassPolicy.sol";

contract WhitelistFactory is GsnRecipient {

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

    event WhitelistModuleCreated(address sender, WhitelistBypassPolicy module);

    function newWhitelist(address vault, address[] memory whitelist) public returns (WhitelistBypassPolicy){
        WhitelistBypassPolicy module = new WhitelistBypassPolicy(vault, whitelist);
        emit WhitelistModuleCreated(getSender(), module);
        return module;
    }
}
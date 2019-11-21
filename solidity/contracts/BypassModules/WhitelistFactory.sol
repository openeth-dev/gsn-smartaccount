pragma solidity ^0.5.10;

import "gsn-sponsor/contracts/GsnRecipient.sol";

import "./WhitelistBypassPolicy.sol";

contract WhitelistFactory is GsnRecipient {

    function _acceptCall(
        address from,
        bytes memory encodedFunction)
    view internal returns (uint256 res, bytes memory data){
        return (0, "");
    }

    function newWhitelist(address vault, address[] memory whitelist) public returns (WhitelistBypassPolicy){
        return new WhitelistBypassPolicy(vault, whitelist);
    }
}
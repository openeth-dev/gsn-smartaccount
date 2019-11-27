pragma solidity ^0.5.10;

import "../BypassModules/BypassPolicy.sol";


contract AllowAllPolicy is BypassPolicy {

    uint256 constant WHITELIST = 0;

    function getBypassPolicy(
        address target,
        uint256 value,
        bytes memory encodedFunction)
    public view returns (uint256, uint256, bool) {
        return (WHITELIST, WHITELIST, false);
    }
}
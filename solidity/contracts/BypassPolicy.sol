pragma solidity ^0.5.10;

contract BypassPolicy {

    uint256 constant WHITELIST = 0;
    uint256 constant USE_DEFAULT = uint(-1);
    /**
     * policy for a specific command:
     * - delay - how much time this call has to be delayed (in seconds).
     *      zero == immediate. 
     *      -1 == use default
     * - requiredConfirmations - how many confirmations needed before executing the call
     *      -1 == use default
     * Revert means block call
     */
    function getBypassPolicy(address target, uint256 value, bytes memory msgdata) public view returns (uint256 delay, uint256 requiredConfirmations);
}

contract DefaultBypassPolicy is BypassPolicy {
    function getBypassPolicy(address target, uint256 value, bytes memory msgdata) public view returns (uint256 delay, uint256 requiredConfirmations ) {
        (target, value, msgdata);
        return (USE_DEFAULT, USE_DEFAULT);
    }
}
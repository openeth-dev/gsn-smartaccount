pragma solidity ^0.5.10;

contract BypassPolicy {
    /**
     * policy for a specific command:
     * - delay - how much time this call has to be delayed (in seconds).
     *      zero == immediate. 
     *      -1 == use level-configured delay
     * - requiredConfirmations - how many confirmations needed before executing the call
     *      -1 == blocked call
     */
    function getBypassPolicy(address target, uint256 value, bytes memory msgdata) public view returns (uint256 delay, uint256 requiredConfirmations);
}

contract DefaultBypassPolicy is BypassPolicy {
    function getBypassPolicy(address target, uint256 value, bytes memory msgdata) public view returns (uint256 delay, uint256 requiredConfirmations ) {
        (target, value, msgdata);
        return (uint256(-1) , 0);
    }
}

contract WhiteListed is BypassPolicy {
    mapping(address => bool) targets;

    function addTarget(address target, bool on) public;

    function getBypassPolicy(address target, uint256 value, bytes memory msgdata) public view returns (uint256 delay, uint256 requiredConfirmations) {
        (target, value, msgdata);
        if (targets[target])
            return (0, 0);
        else
            return (1 days, 0);
    }
}
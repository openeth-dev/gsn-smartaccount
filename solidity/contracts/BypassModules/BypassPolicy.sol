pragma solidity ^0.5.10;

interface BypassPolicy {
    /**
     * policy for a specific command:
     * - delay - how much time this call has to be delayed (in seconds).
     *      zero == immediate. 
     *      -1 == use default
     * - requiredConfirmations - how many confirmations needed before executing the call
     *      -1 == use default
     * Revert means block call
     */
    function getBypassPolicy(address target, uint256 value, bytes calldata msgdata) external view returns (uint256 delay, uint256 requiredConfirmations);
}
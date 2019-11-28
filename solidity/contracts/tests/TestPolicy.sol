pragma solidity ^0.5.10;

import "../BypassModules/BypassPolicy.sol";


contract TestPolicy is BypassPolicy {

    uint256 constant USE_DEFAULT = uint(- 1);

    function getBypassPolicy(
        address target,
        uint256 value,
        bytes memory encodedFunction)
    public view returns (uint256, uint256, bool) {
        (target,value,encodedFunction);
        if (value == 7) {
            // Use default delay, require 1 approval, do not wait for delay if have approvals
            return (USE_DEFAULT, 1, false);
        }
        else {
            // Use default delay, require 1 approval, wait for delay anyways
            return (USE_DEFAULT, 1, true);
        }
    }
}

contract TestContract {
    event WaitForDelay();
    event DoNotWaitForDelay();
    function() external payable {
        if (msg.value == 7){
            emit DoNotWaitForDelay();
        }
        else {
            emit WaitForDelay();
        }
    }
}
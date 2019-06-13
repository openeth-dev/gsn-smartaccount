pragma solidity ^0.5.8;

import "../DelayedOps.sol";

/**
 * test class to test delayed ops.
 */
contract TestDelayedOps is DelayedOps {

    address public allowedSender;
    function setAllowedSender(address s) public { allowedSender = s; }

    uint public delayTime = 2 days;
    function setDelayTime(uint s) public { delayTime = s; }

    function validateOperation(address /*sender*/, bytes memory operation) internal returns (uint) {
        bytes4 sig = getBytes4(operation,0);
        require ( sig == this.invalidOperationParams.selector ||
                  sig == this.doIncrement.selector,
                    "test: delayed op not allowed" );
        return 3 days;
    }

    function sendOp(bytes memory operation) public {
        sendDelayedOp(operation);
    }

    function applyOp(bytes memory operation, uint256 nonce) public {
        applyDelayedOp(operation, nonce);
    }

    function invalidOperationParams() public {}

    function operationMissingFromValidate(address sender) public {}

    event DumpSenders( address msgsender, address sender, address allowed );

    uint public counter;
    function doIncrement(address sender) public {
//        require( allowedSender == sender, "doIncrement: wrong sender" );
        counter++;
    }

}

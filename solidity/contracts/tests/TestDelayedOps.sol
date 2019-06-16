pragma solidity ^0.5.8;

import "../DelayedOps.sol";

/**
 * test class to test delayed ops.
 */
contract TestDelayedOps is DelayedOps {

    address public allowedSender;

    function setAllowedSender(address s) public {
        allowedSender = s;
    }

    function validateOperation(address /*sender*/, uint256 /*delay*/, bytes memory operation) internal {
        bytes4 sig = getBytes4(operation, 0);
        require(
            sig == this.invalidOperationParams.selector ||
            sig == this.sayHelloWorld.selector ||
            sig == this.doIncrement.selector,
            "test: delayed op not allowed");
    }

    function sendOp(bytes memory operation) public {
        sendDelayedOp(operation);
    }

    function applyOp(bytes memory operation, uint256 nonce) public {
        applyDelayedOp(operation, nonce);
    }

    function invalidOperationParams() public {}

    function operationMissingFromValidate(address sender, uint256 delay) public {}

    event DumpSenders(address msgsender, address sender, address allowed);

    event HelloWorld(string message);

    /**
    *
    * @param sender - forced by the 'delayed' protocol. Guaranteed to be the original scheduler of the transaction.
    * @param delay - forced by the 'delayed' protocol. The requested delay that has already passed.
                        Is useful if the method wants to control the delay duration based on it's parameters.
    * @param dayOfBirth - added to demonstrate that the deciding the delay duration can be done beyond the protocol.
    * @param message - just a message to emit.
    */
    function sayHelloWorld(address sender, uint256 delay, uint dayOfBirth, string memory message) public {

        if (dayOfBirth == 4) {
            require(delay >= 2 hours, "Born on thursdays must delay by 2 hours");
        }
        else {
            require(delay >= 2 days, "Everybody must delay by 2 days");
        }
        emit HelloWorld(message);
    }

    uint public counter;

    function doIncrement(address sender, uint256 delay) public {
        //        require( allowedSender == sender, "doIncrement: wrong sender" );
        counter++;
    }

}

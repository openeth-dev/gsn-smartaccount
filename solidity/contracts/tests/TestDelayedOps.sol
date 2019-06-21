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

    function validateOperation(address sender, uint256 /*delay*/, bytes4 methodSig) internal {
        require(
            methodSig == this.sayHelloWorld.selector ||
            methodSig == this.doIncrement.selector,
            "test: delayed op not allowed");
        require(sender == allowedSender, "sender not allowed to perform this delayed op");
    }

    function sendOp(bytes memory operation) public {
        scheduleDelayedOp(msg.sender, 777, getNonce(), operation);
    }

    function applyOp(bytes memory operation, uint256 nonce) public {
        applyDelayedOps(msg.sender, nonce, operation);
    }

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

    function doIncrement() public {
        //        require( allowedSender == sender, "doIncrement: wrong sender" );
        counter++;
    }

    uint256 public someValue = 0;

    function addSome(uint256 howMuch) public {
        someValue = someValue + howMuch;
    }


}

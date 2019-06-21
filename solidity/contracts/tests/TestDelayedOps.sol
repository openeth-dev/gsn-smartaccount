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

    function validateOperation(address sender, bytes4 methodSig) internal {
        require(
            methodSig == this.sayHelloWorld.selector ||
            methodSig == this.addSome.selector ||
            methodSig == this.doIncrement.selector,
            "test: delayed op not allowed");
        require(sender == allowedSender, "sender not allowed to perform this delayed op");

    }

    function sendOp(bytes memory operation) public {
        uint pos = 0;
        bytes memory tx;
        while (pos != EOF) {
            (tx, pos) = nextParam(operation, pos);
            require(LibBytes.readBytes4(tx, 0) != this.sayHelloWorld.selector, "Cannot use sendOp to schedule secure HelloWorld");
        }
        scheduleDelayedOp(msg.sender, 777, getNonce(), operation);
    }

    function scheduleHelloWorld(uint dayOfBirth, string memory message, uint256 delay) public {
        if (dayOfBirth == 4) {
            require(delay >= 2 hours, "Born on thursdays must delay by 2 hours");
        }
        else {
            require(delay >= 2 days, "Everybody must delay by 2 days");
        }
        bytes memory delayedTransaction = abi.encodeWithSelector(this.sayHelloWorld.selector, msg.sender, dayOfBirth, message);
        bytes memory operation = abi.encodePacked(delayedTransaction.length, delayedTransaction);
        scheduleDelayedOp(msg.sender, delay, getNonce(), operation);
    }

    function applyOp(bytes memory operation, uint256 nonce) public {
        applyDelayedOps(msg.sender, nonce, operation);
    }

    function operationMissingFromValidate(address sender, uint256 delay) public {}

    event DumpSenders(address msgsender, address sender, address allowed);

    event HelloWorld(address sender, string message);

    /**
    *
    * @param sender - forced by the 'delayed' protocol. Guaranteed to be the original scheduler of the transaction.
    * @param dayOfBirth - added to demonstrate that the deciding the delay duration can be done beyond the protocol.
    * @param message - just a message to emit.
    */
    function sayHelloWorld(address sender, uint dayOfBirth, string memory message) public {
        emit HelloWorld(sender, message);
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

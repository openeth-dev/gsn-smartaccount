pragma solidity ^0.5.5;

import "./DelayedOps.sol";


contract Vault is DelayedOps {


    event FundsReceived(address sender, uint256 value);

    event FundsKindaTransferred(address destination, uint256 value);


    function() payable external {
        emit FundsReceived(msg.sender, msg.value);
    }

    // Nothing to do with a sender here - it's always Gatekeeper
    // TODO: test to check only 'this' can call here
    function applyDelayedTransaction(address /*sender*/, uint256 delay, address payable destination, uint256 value) public {
        require(value < address(this).balance, "Cannot transfer more then vault's balance");
        destination.transfer(value);
        emit FundsKindaTransferred(destination, value);
    }

    // Why is base classes methods even internal? The only way to 'apply' something is to schedule it first, it
    // is basically a meta-transaction
    function applyDelayedOpsPublic(bytes memory operation, uint256 nonce) public {
        applyDelayedOp(operation, nonce);
    }

    function validateOperation(address sender, bytes4 methodSig) internal {}

    // TODO: test to check 'gatekeeperOnly' logic here!
    function scheduleDelayedTransaction(uint256 delay, address destination, uint256 value) public {
        // Alexf: There is no tragedy in using 'encodeWithSelector' here, I believe. Vault's API should not change much.
        bytes memory delayedTransaction = abi.encodeWithSelector(this.applyDelayedTransaction.selector, msg.sender, delay, destination, value);
        sendDelayedOp(delayedTransaction);
    }

    function cancelTransaction(bytes32 hash) public {
        cancelDelayedOp(hash);
    }


}
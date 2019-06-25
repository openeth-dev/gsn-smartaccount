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
    function applyDelayedTransaction(address payable destination, uint256 value) public {
        require(value < address(this).balance, "Cannot transfer more then vault's balance");
        destination.transfer(value);
        emit FundsKindaTransferred(destination, value);
    }

    // TODO: sender of all operations in vault is a gatekeeper!!!
    function applyDelayedOpsPublic(address sender, bytes memory operation, uint256 nonce) public {
        applyDelayedOps(sender, 0, nonce, operation);
    }

    function validateOperation(address sender, uint256 extraData, bytes4 methodSig) internal {}

    // TODO: test to check 'gatekeeperOnly' logic here!
    function scheduleDelayedTransaction(uint256 delay, address destination, uint256 value) public {
        // Alexf: There is no tragedy in using 'encodeWithSelector' here, I believe. Vault's API should not change much.
        bytes memory delayedTransaction = abi.encodeWithSelector(this.applyDelayedTransaction.selector, destination, value);
        bytes memory operation = abi.encodePacked(delayedTransaction.length, delayedTransaction);
        scheduleDelayedBatch(msg.sender, 0, delay, getNonce(), operation);
    }

    function cancelTransaction(bytes32 hash) public {
        cancelDelayedOp(hash);
    }


}
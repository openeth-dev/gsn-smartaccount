pragma solidity ^0.5.5;

import "./DelayedOps.sol";


contract Vault is DelayedOps {


    event FundsReceived(address sender, uint256 value);

    event FundsKindaTransferred(address destination, uint256 value);

    // ***** Start TDD temp methods

    address gatekeeper;

    function setGatekeeper(address gatekeeperAddress) public
    {
        gatekeeper = gatekeeperAddress;
    }

    // ***** End TDD temp methods

    function() payable external {
        emit FundsReceived(msg.sender, msg.value);
    }


    function validateOperation(address sender, uint256 extraData, bytes4 methodSig) internal {}


    // ********** Immediate operations below this point

    // TODO: test to check 'gatekeeperOnly' logic here!
    function scheduleDelayedEtherTransfer(uint256 delay, address destination, uint256 value) public {
        // Alexf: There is no tragedy in using 'encodeWithSelector' here, I believe. Vault's API should not change much.
        bytes memory delayedTransaction = abi.encodeWithSelector(this.transferETH.selector, destination, value);
        bytes memory operation = abi.encodePacked(delayedTransaction.length, delayedTransaction);
        scheduleDelayedBatch(msg.sender, 0, delay, getNonce(), operation);
    }

    function scheduleDelayedTokenTransfer(uint256 delay, address destination, uint256 value, address token) public {

    }

    function cancelTransfer(bytes32 hash) public {
        cancelDelayedOp(hash);
    }

    // TODO: sender of all operations in vault is a gatekeeper!!!
    function applyDelayedTransfer(bytes memory operation, uint256 nonce) public {
        applyDelayedOps(msg.sender, 0, nonce, operation);
    }


    // ********** Delayed operations below this point

    // Nothing to do with a sender here - it's always Gatekeeper
    // TODO: test to check only 'this' can call here
    function transferETH(address payable destination, uint256 value) public {
        require(value < address(this).balance, "Cannot transfer more then vault's balance");
        destination.transfer(value);
        emit FundsKindaTransferred(destination, value);
    }

    function transferERC20(address payable destination, uint256 value, address token) public {

    }

}
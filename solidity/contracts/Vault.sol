pragma solidity ^0.5.5;


contract Vault {


    event FundsReceived(address sender, uint256 value);
    event TransactionPending();

    function() payable external {
        emit FundsReceived(msg.sender, msg.value);
    }

    function sendDelayedTransaction(uint /*val*/) public {

        emit TransactionPending();
    }

}
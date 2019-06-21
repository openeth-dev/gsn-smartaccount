pragma solidity ^0.5.5;

import "./DelayedOps.sol";
import "./Vault.sol";

contract Gatekeeper is DelayedOps {

    Vault vault;
    address participantSpender;
    uint256 delay = 1 hours;

    // TEMP, FOR TDD
    function setDelay(uint256 delayParam) public
    {
        delay = delayParam;
    }

    // TEMP, FOR TDD
    function setVault(Vault vaultParam) public
    {
        vault = vaultParam;
    }

    // TEMP, FOR TDD
    function setSpender(address spender) public
    {
        participantSpender = spender;
    }


    function validateOperation(address sender, bytes4 methodSig) internal {
    }

    function sendEther(address payable destination, uint value) public {
        require(msg.sender == participantSpender, "Only spender can perform send operations!");
        vault.scheduleDelayedTransaction(delay, destination, value);
    }

    function cancelTransaction(bytes32 hash) public {
        vault.cancelTransaction(hash);
    }

    event OperationCancelled(address sender, bytes32 hash);

    function cancelOperation(bytes32 hash) public {
        cancelDelayedOp(hash);
    }
}
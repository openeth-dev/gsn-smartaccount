pragma solidity ^0.5.5;

import "./DelayedOps.sol";
import "./Vault.sol";

contract Gatekeeper is DelayedOps {

    Vault vault;
    address participantSpender;
    address participantAdminA;
    address participantAdminB;
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

    // TEMP, FOR TDD
    function setAdminA(address adminA) public
    {
        participantAdminA = adminA;
    }

    // TEMP, FOR TDD
    function setAdminB(address adminB) public
    {
        participantAdminB = adminB;
    }
    // TODO:
    //  1. Participant control (hashes map + isParticipant)
    //  2. Delay per rank control (if supported in BizPoC-2)
    //  3. Initial configuration
    // ***********************************


    function validateOperation(address sender, bytes4 methodSig) internal {
    }

    function sendBatch(bytes memory batch) public {
        scheduleDelayedBatch(msg.sender, delay, getNonce(), batch);
    }

    function sendEther(address payable destination, uint value) public {
        require(msg.sender == participantSpender, "Only spender can perform send operations!");
        vault.scheduleDelayedTransaction(delay, destination, value);
    }

    event ParticipantAdded(address participant);

    function addParticipant(address participant) public {
        emit ParticipantAdded(participant);
    }

    function cancelTransaction(bytes32 hash) public {
        vault.cancelTransaction(hash);
    }

    event OperationCancelled(address sender, bytes32 hash);

    function cancelOperation(bytes32 hash) public {
        cancelDelayedOp(hash);
    }
}
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

    // TODO:
    //  1. Participant control (hashes map + isParticipant)
    //  2. Delay per rank control (if supported in BizPoC-2)
    //  3. Initial configuration
    // ***********************************

    // ? There are no roles in bizpoc. There is a single spender and few admins.
    // we had these (role, rank) all over the place.
    // TODO: decide if there is a need to keep 'participant' concept for now

    mapping(bytes32 => bool) public participants;
    bytes32 spenderHash;

    function isAdmin(address admin, uint8 level) view public returns (bool) {
        return participants[adminHash(admin, level)];
    }

    function adminHash(address participant, uint8 rank) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(participant, rank));
    }

    function validateOperation(address sender, bytes4 methodSig) internal {
    }

    function sendBatch(bytes memory batch) public {
        scheduleDelayedBatch(msg.sender, delay, getNonce(), batch);
    }

    function applyBatch(bytes memory operation, uint256 nonce) public {
        applyDelayedOps(msg.sender, nonce, operation);
    }

    function sendEther(address payable destination, uint value) public {
        require(msg.sender == participantSpender, "Only spender can perform send operations!");
        vault.scheduleDelayedTransaction(delay, destination, value);
    }

    event ParticipantAdded(bytes32 indexed participant);
    event ParticipantRemoved(bytes32 indexed participant);

    // TODO: currently is 'addAdmin' as no other role is defined
    // TODO: obviously does not conceal the level and identity
    function addParticipant(address participant, uint8 level) public {
        participants[adminHash(participant, level)] = true;
        emit ParticipantAdded(adminHash(participant, level));
    }

    function removeParticipant(bytes32 participant) public {
        require(participants[participant], "there is no such participant");
        delete participants[participant];
        emit ParticipantRemoved(participant);
    }

    function cancelTransaction(bytes32 hash) public {
        vault.cancelTransaction(hash);
    }

    event OperationCancelled(address sender, bytes32 hash);

    function cancelOperation(bytes32 hash) public {
        cancelDelayedOp(hash);
    }
}
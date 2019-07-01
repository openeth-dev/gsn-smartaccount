pragma solidity ^0.5.5;

import "./DelayedOps.sol";
import "./Vault.sol";

contract Gatekeeper is DelayedOps {

    Vault vault;
    // **** Vault events
    event TransactionCompleted(address destination, uint value, ERC20 erc20token, uint256 nonce);
    // ****


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
        participants[adminHash(spender, 0xffff, 1)] = true;
    }


    // TEMP, FOR TDD
    function addParticipantInit(address participant, uint16 permissions, uint8 level) public {
        participants[adminHash(participant, permissions, level)] = true;
    }

    // TODO:
    //  1. Participant control (hashes map + isParticipant)
    //  2. Delay per rank control (if supported in BizPoC-2)
    //  3. Initial configuration
    // ***********************************

    event OperationCancelled(address sender, bytes32 hash);


    uint16 constant public spend = 1 << 0;
    uint16 constant public cancel_spend = 1 << 1;
    uint16 constant public freeze = 1 << 2;
    uint16 constant public unfreeze = 1 << 3;
    uint16 constant public add_participant = 1 << 4;
    uint16 constant public cancel_add_participant = 1 << 5;
    uint16 constant public remove_participant = 1 << 6;
    uint16 constant public cancel_remove_participant = 1 << 7;
    uint16 constant public give_boost = 1 << 8;
    uint16 constant public receive_boost = 1 << 9;

    uint16 public ownerPermissions = spend | cancel_spend | freeze | unfreeze | add_participant | cancel_add_participant | remove_participant | cancel_remove_participant | give_boost;
    uint16 public adminPermissions = add_participant | cancel_add_participant | remove_participant | receive_boost;
    uint16 public watchdogPermissions = cancel_spend | cancel_add_participant | cancel_remove_participant | freeze;

    mapping(bytes32 => bool) public participants;


    event ParticipantAdded(bytes32 indexed participant);
    event ParticipantRemoved(bytes32 indexed participant);

    event HasPermission(uint256 permMasked, uint256 extras);

    // ********** Function modifiers below this point
    modifier participantOnly(address participant, uint16 permissions, uint8 level){
        require(participants[adminHash(participant, permissions, level)], "not participant");
        // Training wheels. Can be removed if we want more freedom, but can be left if we want some hard-coded enforcement of rules in code
        require(permissions == ownerPermissions || permissions == adminPermissions || permissions == watchdogPermissions || permissions == 0xffff, "use defaults or go compile your vault from sources");
        _;
    }
    modifier hasPermission(uint16 permission) {
        (, uint256 extras) = getScheduledExtras();
        require(extras & permission != 0, "not allowed");
        _;
    }

    // ********** Pure view functions below this point

    function adminHash(address participant, uint16 permissions, uint8 rank) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(participant, permissions, rank));
    }

    function validateOperation(address sender, uint256 extraData, bytes4 methodSig) internal {
    }

    // ********** Immediate operations below this point


    function sendBatch(bytes memory batch, uint16 sender_permissions) public {
        scheduleDelayedBatch(msg.sender, sender_permissions, delay, batch);
    }

    function applyBatch(bytes memory operation, uint16 sender_permissions, uint256 nonce) participantOnly(msg.sender, sender_permissions, 1) public {
        applyDelayedOps(msg.sender, sender_permissions, nonce, operation);
    }

    function sendEther(address payable destination, uint value, uint16 sender_permissions) participantOnly(msg.sender, sender_permissions, 1) public {
        require(sender_permissions & spend != 0, "not allowed");
        vault.scheduleDelayedEtherTransfer(delay, destination, value);
    }

    function applyTransfer(bytes memory operation, uint256 nonce, uint16 sender_permissions)
        // TODO: this is an 'owner' special case related flow
        //    participantOnly(msg.sender, sender_permissions, 1)
    public {
        vault.applyDelayedTransfer(operation, nonce);
    }

    function cancelTransfer(bytes32 hash) public {
        vault.cancelTransfer(hash);
    }

    function cancelOperation(bytes32 hash) public {
        cancelDelayedOp(hash);
    }

    // ********** Delayed operations below this point

    // TODO: obviously does not conceal the level and identity
    function addParticipant(address participant, uint16 permissions, uint8 level) hasPermission(add_participant) public {
        participants[adminHash(participant, permissions, level)] = true;
        emit ParticipantAdded(adminHash(participant, permissions, level));
    }

    function removeParticipant(bytes32 participant) hasPermission(remove_participant) public {
        require(participants[participant], "there is no such participant");
        delete participants[participant];
        emit ParticipantRemoved(participant);
    }

}
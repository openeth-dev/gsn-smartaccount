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
    function setOperator(address operatorParam) public
    {
        participants[adminHash(operatorParam, ownerPermissions, 1)] = true;
        operator = operatorParam;
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


    uint16 constant public canSpend = 1 << 0;

    uint16 constant public canUnfreeze = 1 << 3;
    uint16 constant public canChangeParticipants = 1 << 4;

    // 'owner' is a participant that holds most of permissions. It is locked at level 1. There can only be one 'owner' in the contract.
    // Note that there is no 'cancel change owner' permission - same as in original design, once 'chown' is scheduled, it follows the regular 'config change' algorithm
    uint16 constant public canChangeOwner = 1 << 10;

    // TODO: Cancels are asymmetrical in nature:
    //  We cannot differentiate who can cancel what delayed operation.
    //  That is theoretically possible, but would require parsing the operation you are about to cancel.
    // Currently, config changes are: add, remove, chown, unfreeze.

    // There was some confusion what is 'give' and 'get' in the context of 'boost'
    uint16 constant public canSignBoosts = 1 << 8;
    uint16 constant public canExecuteBoosts = 1 << 9;

    // Instant Run Permissions - these actions do not require delays
    uint16 constant public canFreeze = 1 << 2;
    uint16 constant public canCancelConfigChanges = 1 << 5;
    uint16 constant public canCancelSpend = 1 << 1;

    // If the operation is delayed, it's hard to enforce separate permissions for it. (Possible, though. Ask me how.)
    uint16 public canChangeConfig = canUnfreeze | canChangeParticipants | canChangeOwner /* | canChangeDelays */;
    uint16 public canCancel = canCancelSpend | canCancelConfigChanges;


    uint16 public ownerPermissions = canSpend | canCancel | canFreeze | canChangeConfig | canSignBoosts;
    uint16 public adminPermissions = canChangeOwner | canExecuteBoosts;
    uint16 public watchdogPermissions = canCancel | canFreeze;

    event ParticipantAdded(bytes32 indexed participant);
    event ParticipantRemoved(bytes32 indexed participant);

    mapping(bytes32 => bool) public participants;
    address operator;

    // ********** Function modifiers below this point
    modifier participantOnly(address participant, uint16 permissions, uint8 level){
        require(participants[adminHash(participant, permissions, level)], "not participant");

        require(permissions != ownerPermissions || participant == operator, "This participant is not a real operator, fix your vault configuration");
        // Training wheels. Can be removed if we want more freedom, but can be left if we want some hard-coded enforcement of rules in code
        require(permissions == ownerPermissions || permissions == adminPermissions || permissions == watchdogPermissions, "use defaults or go compile your vault from sources");
        _;
    }

    // ********** Pure view functions below this point

    function adminHash(address participant, uint16 permissions, uint8 rank) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(participant, permissions, rank));
    }

    function validateOperation(address sender, uint256 extraData, bytes4 methodSig) internal {
    }

    function changeConfiguration(address sender, uint16 senderPermissions, bytes memory batch) participantOnly(sender, senderPermissions, 1) hasPermissions(canChangeConfig, senderPermissions) public {
        scheduleDelayedBatch(msg.sender, senderPermissions, delay, batch);
    }

    function applyBatch(bytes memory operation, uint16 sender_permissions, uint256 nonce) participantOnly(msg.sender, sender_permissions, 1) public {
        applyDelayedOps(msg.sender, sender_permissions, nonce, operation);
    }

    function sendEther(address payable destination, uint value, uint16 sender_permissions) participantOnly(msg.sender, sender_permissions, 1) public {
        require(sender_permissions & canSpend != 0, "not allowed");
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

    modifier hasPermissions(uint16 permissions, uint16 senderPermissions) {
        // Fix: sender has ALL the permissions in the 'permissions' flags bit mask
        require(permissions & senderPermissions == permissions, "not allowed");
        _;
    }

    // ********** Delayed operations below this point

    // TODO: obviously does not conceal the level and identity
    function addParticipant(address sender, uint16 senderPermissions, address participant, uint16 permissions, uint8 level) hasPermissions(canChangeParticipants, senderPermissions) public {
        participants[adminHash(participant, permissions, level)] = true;
        emit ParticipantAdded(adminHash(participant, permissions, level));
    }

    function removeParticipant(address sender, uint16 senderPermissions, bytes32 participant) hasPermissions(canChangeParticipants, senderPermissions) public {
        require(participants[participant], "there is no such participant");
        delete participants[participant];
        emit ParticipantRemoved(participant);
    }

}
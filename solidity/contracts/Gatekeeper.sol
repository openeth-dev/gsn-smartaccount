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


    // TODO: this is damn stupid. There has to be a better way...
    //  ! Note: this IS NOT solved in current Gatekeeper implementation by Yoav
    // ! If operator adds a 'participant' owner of rank 100, he is allowed to do that
    //  ! and it seems to me it will pass all 'is_not_frozen(rank)', 'isOperator' and 'is_participant' checks
    // ! allowing owner to perform 'takeover' from guardians.
    mapping(address => uint16[]) public permissionsHeld;
    mapping(uint16 => int) public permissionsHolderCount;

    function isRevealedPerm(address participant, uint16 permissions) public returns (bool){
        for (uint256 i = 0; i < permissionsHeld[participant].length; i++) {
            if (permissionsHeld[participant][i] == permissions) {
                return true;
            }
        }
        return false;
    }

    modifier participantOnly(address participant, uint16 permissions, uint8 level){
        if (!isRevealedPerm(participant, permissions)) {
            permissionsHeld[participant].push(permissions);
            permissionsHolderCount[permissions] = permissionsHolderCount[permissions] + 1;
        }

        require(participants[adminHash(participant, permissions, level)], "not participant");
        // Training wheels. Can be removed if we want more freedom, but can be left if we want some hard-coded enforcement of rules in code
        require(permissions == ownerPermissions || permissions == adminPermissions || permissions == watchdogPermissions, "use defaults or go compile your vault from sources");
        // Enforce only 1 owner without duplicating all code around a 'address owner' field. Also shall be configurable.
        require(permissions != ownerPermissions || permissionsHolderCount[permissions] == 1, "cannot have 2 owners");
        _;
    }

    function adminHash(address participant, uint16 permissions, uint8 rank) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(participant, rank));
    }

    function validateOperation(address sender, uint256 extraData, bytes4 methodSig) internal {
    }

    function sendBatch(bytes memory batch, uint16 sender_permissions) public {
        scheduleDelayedBatch(msg.sender, sender_permissions, delay, getNonce(), batch);
    }

    function applyBatch(bytes memory operation, uint16 sender_permissions, uint256 nonce) public {
        applyDelayedOps(msg.sender, sender_permissions, nonce, operation);
    }

    function sendEther(address payable destination, uint value) public {
        require(msg.sender == participantSpender, "Only spender can perform send operations!");
        vault.scheduleDelayedTransaction(delay, destination, value);
    }

    event ParticipantAdded(bytes32 indexed participant);
    event ParticipantRemoved(bytes32 indexed participant);

    // TODO: obviously does not conceal the level and identity
    function addParticipant(address participant, uint16 permissions, uint8 level) public {
        participants[adminHash(participant, permissions, level)] = true;
        emit ParticipantAdded(adminHash(participant, permissions, level));
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
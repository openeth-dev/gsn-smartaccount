pragma solidity ^0.5.10;

import "@0x/contracts-utils/contracts/src/LibBytes.sol";

import "./BypassModules/BypassPolicy.sol";
import "./PermissionsLevel.sol";
import "./Utilities.sol";
import "gsn-sponsor/contracts/GsnRecipient.sol";

contract SmartAccountBase is GsnRecipient, PermissionsLevel {
    using LibBytes for bytes;
    uint256 constant USE_DEFAULT = uint(- 1);
    uint256 constant maxParticipants = 20;
    uint256 constant maxLevels = 10;
    uint256 constant maxDelay = 365 days;
    uint256 constant maxFreeze = 365 days;

    enum ChangeType {
        ADD_PARTICIPANT, // arg: participant_hash
        REMOVE_PARTICIPANT, // arg: participant_hash
        ADD_BYPASS_BY_TARGET,
        ADD_BYPASS_BY_METHOD,
        SET_ACCELERATED_CALLS,
        UNFREEZE, // no args
        ADD_OPERATOR,
        ADD_OPERATOR_NOW
    }

    //***** events
    event DEBUG(bool isPart);
    event DEBUG(bytes4 sig);
    event ConfigPending(bytes32 indexed delayedOpId, address sender, uint32 senderPermsLevel, address booster, uint32 boosterPermsLevel, uint256 stateId, uint8[] actions, bytes32[] actionsArguments1, bytes32[] actionsArguments2, uint256 dueTime);
    event ConfigCancelled(bytes32 indexed delayedOpId, address sender);
    event ConfigApplied(bytes32 indexed delayedOpId, address sender);
    event ParticipantAdded(address indexed participant, uint32 permissions, uint8 level);
    event ParticipantRemoved(address indexed participant, uint32 permissions, uint8 level);
    event SmartAccountInitialized(bytes32[] participants, uint256[] delays, uint256[] requiredApprovalsPerLevel, address[] bypassModules);
    event LevelFrozen(uint256 frozenLevel, uint256 frozenUntil, address sender);
    event UnfreezeCompleted();
    event BypassByTargetAdded(address target, BypassPolicy  indexed bypass);
    event BypassByMethodAdded(bytes4 method, BypassPolicy indexed bypass);
    event BypassByTargetRemoved(address target, BypassPolicy indexed bypass);
    event BypassByMethodRemoved(bytes4 method, BypassPolicy indexed bypass);
    event BypassCallPending(bytes32 indexed delayedOpId, uint256 stateId, address sender, uint32 senderPermsLevel, address target, uint256 value, bytes msgdata, uint256 dueTime);
    event BypassCallCancelled(bytes32 indexed delayedOpId, address sender);
    event BypassCallApplied(bytes32 indexed delayedOpId, bool status);
    event BypassCallExecuted(bool status);
    event AcceleratedCAllSet(bool status);
    event AddOperatorNowSet(bool status);
    event FundsReceived(uint256 value);

    struct PendingChange {
        uint256 dueTime;
        bytes32[] approvers;
    }

    mapping(bytes32 => bool) public participants;

    uint256 public frozenLevel;
    uint256 public frozenUntil;

    uint256 public stateNonce;

    uint256 public deployedBlock;

    address public creator;

    mapping(bytes32 => PendingChange) public pendingChanges;
    uint256[] public delays;
    mapping(address => BypassPolicy) public bypassPoliciesByTarget; // instance level bypass exceptions
    mapping(bytes4 => BypassPolicy) public bypassPoliciesByMethod; // interface (method sigs) level bypass exceptions
    // TODO: do not call this 'bypass calls', this does not describe what these are.
    mapping(bytes32 => PendingChange) public pendingBypassCalls;
    bool public allowAcceleratedCalls;
    // 0 - no approvals needed before applying
    uint256[] public requiredApprovalsPerLevel;

    address public bypassLib;

    function getApprovalsPerLevel() public view returns (uint256[] memory) {
        return requiredApprovalsPerLevel;
    }

    function getDelays() public view returns (uint256[] memory) {
        return delays;
    }

    function getPendingChange(bytes32 hash) public view returns (uint256 dueTime, bytes32[] memory approvers) {
        return (pendingChanges[hash].dueTime, pendingChanges[hash].approvers);
    }

    // ********** Access control functions below this point

    function requireNotFrozen(uint32 senderPermsLevel, string memory errorMessage) view internal {
        uint8 senderLevel = extractLevel(senderPermsLevel);
        require(now > frozenUntil || senderLevel > frozenLevel, errorMessage);
    }

    function requireNotFrozen(uint32 senderPermsLevel) view internal {
        requireNotFrozen(senderPermsLevel, "level is frozen");
    }

    function isParticipant(address participant, uint32 permsLevel) public view returns (bool) {
        bytes32 participantId = Utilities.encodeParticipant(participant, permsLevel);
        return participants[participantId];
    }

    function requireParticipant(address participant, uint32 permsLevel) view internal {
        require(isParticipant(participant, permsLevel), "not participant");
    }

    function requirePermissions(address sender, uint32 neededPermissions, uint32 senderPermsLevel) view internal {
        requireParticipant(sender, senderPermsLevel);
        uint32 senderPermissions = extractPermission(senderPermsLevel);
        comparePermissions(neededPermissions, senderPermissions);
    }

    function requireCorrectState(uint256 targetStateNonce) view internal {
        require(stateNonce == targetStateNonce, "incorrect state");
    }

    function hasApproved(bytes32 participant, bytes32[] memory approvers) internal pure returns (bool) {
        for (uint256 i = 0; i < approvers.length; i++) {
            if (approvers[i] == participant) return true;
        }
        return false;
    }

    function getBypassPolicy(
        address target,
        uint256 value,
        bytes memory encodedFunction)
    public view returns (
        uint256 delay,
        uint256 requiredApprovals,
        bool requireBothDelayAndApprovals) {
        BypassPolicy bypass = bypassPoliciesByTarget[target];
        if (address(bypass) == address(0)) {
            bytes4 method = '';
            if (encodedFunction.length >= 4) {
                method = encodedFunction.readBytes4(0);
            }
            bypass = bypassPoliciesByMethod[method];
        }
        if (address(bypass) == address(0)) {
            return (USE_DEFAULT, USE_DEFAULT, true);
        }
        return bypass.getBypassPolicy(target, value, encodedFunction);
    }
}
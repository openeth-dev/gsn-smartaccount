pragma solidity ^0.5.10;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "gsn-sponsor/contracts/GsnRecipient.sol";
import "@0x/contracts-utils/contracts/src/LibBytes.sol";

import "../SmartAccountBase.sol";
import "../PermissionsLevel.sol";
import "../Utilities.sol";

contract BypassLib is SmartAccountBase {
    function removeBypassByTarget(
        uint32 senderPermsLevel,
        address target)
    public {
        address sender = getSender();
        requirePermissions(sender, canChangeBypass, senderPermsLevel);
        requireNotFrozen(senderPermsLevel);
        BypassPolicy bypass = bypassPoliciesByTarget[target];
        delete bypassPoliciesByTarget[target];
        emit BypassByTargetRemoved(target, bypass);
        stateNonce++;
    }

    function removeBypassByMethod(
        uint32 senderPermsLevel,
        bytes4 method)
    public {
        address sender = getSender();
        requirePermissions(sender, canChangeBypass, senderPermsLevel);
        requireNotFrozen(senderPermsLevel);
        BypassPolicy bypass = bypassPoliciesByMethod[method];
        delete bypassPoliciesByMethod[method];
        emit BypassByMethodRemoved(method, bypass);
        stateNonce++;
    }

    function addBypassByTarget(
        address sender,
        uint32 senderPermsLevel,
        address target,
        BypassPolicy bypass)
    public {
        requirePermissions(sender, canChangeBypass, senderPermsLevel);
        bypassPoliciesByTarget[target] = bypass;
        emit BypassByTargetAdded(target, bypass);
    }

    function addBypassByMethod(
        address sender,
        uint32 senderPermsLevel,
        bytes4 method,
        BypassPolicy bypass)
    public {
        requirePermissions(sender, canChangeBypass, senderPermsLevel);
        bypassPoliciesByMethod[method] = bypass;
        emit BypassByMethodAdded(method, bypass);
    }

    function scheduleBypassCall(
        uint32 senderPermsLevel,
        address target,
        uint256 value,
        bytes memory encodedFunction,
        uint256 targetStateNonce)
    public {
        address sender = getSender();
        requirePermissions(sender, canExecuteBypassCall, senderPermsLevel);
        requireNotFrozen(senderPermsLevel);
        requireCorrectState(targetStateNonce);

        (uint256 delay,,) = getBypassPolicy(target, value, encodedFunction);
        require(allowAcceleratedCalls || delay >= delays[extractLevel(senderPermsLevel)], "Accelerated calls blocked - delay too short");
        if (delay == USE_DEFAULT) {
            delay = delays[extractLevel(senderPermsLevel)];
        }
        bytes32 bypassCallHash = Utilities.bypassCallHash(stateNonce, sender, senderPermsLevel, target, value, encodedFunction);
        uint256 dueTime = SafeMath.add(now, delay);
        pendingBypassCalls[bypassCallHash] = PendingChange(dueTime, new bytes32[](0));
        emit BypassCallPending(bypassCallHash, stateNonce, sender, senderPermsLevel, target, value, encodedFunction, dueTime);
        stateNonce++;
    }

    function approveBypassCall(
        uint32 senderPermsLevel,
        address scheduler,
        uint32 schedulerPermsLevel,
        uint256 scheduledStateNonce,
        address target,
        uint256 value,
        bytes memory encodedFunction)
    public {
        address sender = getSender();
        requirePermissions(sender, canApprove, senderPermsLevel);
        requireNotFrozen(senderPermsLevel);
        requireNotFrozen(schedulerPermsLevel);

        bytes32 bypassCallHash = Utilities.bypassCallHash(scheduledStateNonce, scheduler, schedulerPermsLevel, target, value, encodedFunction);
        PendingChange storage pendingBypassCall = pendingBypassCalls[bypassCallHash];
        require(pendingBypassCall.dueTime != 0, "non existent pending bypass call");
        bytes32 approver = Utilities.encodeParticipant(sender, senderPermsLevel);
        require(!hasApproved(approver, pendingBypassCall.approvers), "Cannot approve twice");
        pendingBypassCall.approvers.push(approver);
        stateNonce++;
    }

    function applyBypassCall(
        uint32 senderPermsLevel,
        address scheduler,
        uint32 schedulerPermsLevel,
        uint256 scheduledStateNonce,
        address target,
        uint256 value,
        bytes memory encodedFunction)
    public {
        address sender = getSender();
        requireParticipant(sender, senderPermsLevel);
        requireNotFrozen(senderPermsLevel);
        requireNotFrozen(schedulerPermsLevel);

        bytes32 bypassCallHash = Utilities.bypassCallHash(scheduledStateNonce, scheduler, schedulerPermsLevel, target, value, encodedFunction);
        PendingChange memory pendingBypassCall = pendingBypassCalls[bypassCallHash];
        (uint256 delay, uint256 requiredApprovals, bool requireBothDelayAndApprovals) = getBypassPolicy(target, value, encodedFunction);
        if (delay == USE_DEFAULT && requiredApprovals == USE_DEFAULT) {
            requireBothDelayAndApprovals = true;
        }
        require(pendingBypassCall.dueTime != 0, "non existent pending bypass call");
        require(now >= pendingBypassCall.dueTime || !requireBothDelayAndApprovals, "before due time");
        if (requiredApprovals == USE_DEFAULT) {
            requiredApprovals = requiredApprovalsPerLevel[extractLevel(schedulerPermsLevel)];
        }
        require(pendingBypassCall.approvers.length >= requiredApprovals, "Pending approvals");
        delete pendingBypassCalls[bypassCallHash];
        bool success = _execute(target, value, encodedFunction);
        emit BypassCallApplied(bypassCallHash, success);
        stateNonce++;
    }

    function cancelBypassCall(
        uint32 senderPermsLevel,
        address scheduler,
        uint32 schedulerPermsLevel,
        uint256 scheduledStateNonce,
        address target,
        uint256 value,
        bytes memory encodedFunction)
    public {
        address sender = getSender();
        requirePermissions(sender, canCancelBypassCall, senderPermsLevel);
        requireNotFrozen(senderPermsLevel);

        bytes32 bypassCallHash = Utilities.bypassCallHash(scheduledStateNonce, scheduler, schedulerPermsLevel, target, value, encodedFunction);
        PendingChange memory pendingBypassCall = pendingBypassCalls[bypassCallHash];
        require(pendingBypassCall.dueTime != 0, "non existent pending bypass call");
        delete pendingBypassCalls[bypassCallHash];
        emit BypassCallCancelled(bypassCallHash, sender);
        stateNonce++;
    }

    function executeBypassCall(
        uint32 senderPermsLevel,
        address target,
        uint256 value,
        bytes memory encodedFunction,
        uint256 targetStateNonce)
    public {
        address sender = getSender();
        requirePermissions(sender, canExecuteBypassCall, senderPermsLevel);
        requireNotFrozen(senderPermsLevel);
        require(allowAcceleratedCalls, "Accelerated calls blocked");
        requireCorrectState(targetStateNonce);

        (uint256 delay, uint256 requiredApprovals,) = getBypassPolicy(target, value, encodedFunction);
        require(delay == 0 && requiredApprovals == 0, "Call cannot be executed immediately");
        bool success = _execute(target, value, encodedFunction);
        emit BypassCallExecuted(success);
        stateNonce++;
    }

    function _execute(address target, uint256 value, bytes memory encodedFunction) internal returns (bool success){
        (success,) = target.call.value(value)(encodedFunction);
    }

    function _acceptCall( address from, bytes memory encodedFunction) view internal returns (uint256 res, bytes memory data) {}

    function () external {
        emit DEBUG(msg.sig);
    }
}
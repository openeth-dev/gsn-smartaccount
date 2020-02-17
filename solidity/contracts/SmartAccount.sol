pragma solidity ^0.5.10;

/* node modules */
import "@0x/contracts-utils/contracts/src/LibBytes.sol";
import "gsn-sponsor/contracts/GsnRecipient.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "tabookey-gasless/contracts/GsnUtils.sol";

import "./PermissionsLevel.sol";
import "./Utilities.sol";
import "./BypassModules/BypassPolicy.sol";
import "./SmartAccountBase.sol";
import "./BypassModules/BypassLib.sol";


contract SmartAccount is SmartAccountBase {
    using LibBytes for bytes;
    modifier delegateToBypassLib(){
        _;
        address bl = bypassLib;
        assembly {
            let ptr := mload(0x40)
//            let delegateTo := and(sload(bypassLib_slot), 0xffffffffffffffffffffffffffffffffffffffff)
            calldatacopy(ptr, 0, calldatasize())
            let result := delegatecall(gas, bl, ptr, calldatasize(), 0, 0)
            returndatacopy(ptr, 0, returndatasize())
            switch result
            case 0 { revert(ptr, returndatasize()) }
            default { return(ptr, returndatasize()) }
        }
    }
    event DEBUG(address bypasslib);
    constructor (address _bypassLib) public {
        bypassLib = _bypassLib;
    }

    //constructor-method. Must be called immediately after construction
    // (or after proxy creation)
    function ctr2(address _forwarder, address _creator, address _bypassLib) public {
        require(creator == address(0), "ctr2: can only be called once");
        setGsnForwarder(_forwarder);
        deployedBlock = block.number;
        creator = _creator;
        bypassLib = _bypassLib;
    }

    function initialConfig(
        bytes32[] memory initialParticipants,
        uint256[] memory initialDelays,
        bool _allowAcceleratedCalls,
        uint256[] memory _requiredApprovalsPerLevel,
        address[] memory bypassTargets,
        bytes4[]  memory bypassMethods,
        address[] memory bypassModules
    ) public {
        require(getSender() == creator, "must be called by creator");
        require(stateNonce == 0, "already initialized");
        require(initialParticipants.length <= maxParticipants, "too many participants");
        require(initialDelays.length <= maxLevels, "too many levels");
        require(_requiredApprovalsPerLevel.length <= maxLevels, "too many levels again");
        require(bypassTargets.length + bypassMethods.length == bypassModules.length, "wrong number of bypass modules");

        for (uint8 i = 0; i < initialParticipants.length; i++) {
            participants[initialParticipants[i]] = true;
        }
        for (uint8 i = 0; i < initialDelays.length; i++) {
            require(initialDelays[i] < maxDelay, "Delay too long");
        }
        delays = initialDelays;
        allowAcceleratedCalls = _allowAcceleratedCalls;
        requiredApprovalsPerLevel = _requiredApprovalsPerLevel;

        emit SmartAccountInitialized(initialParticipants, delays, requiredApprovalsPerLevel, bypassModules);
        for (uint8 i = 0; i < bypassTargets.length; i++) {
            bypassPoliciesByTarget[bypassTargets[i]] = BypassPolicy(bypassModules[i]);
        }
        for (uint8 i = 0; i < bypassMethods.length; i++) {
            bypassPoliciesByMethod[bypassMethods[i]] = BypassPolicy(bypassModules[i + bypassTargets.length]);
        }
        stateNonce++;
    }

    // ****** Immediately runnable functions below this point

    function freeze(uint32 senderPermsLevel, uint8 levelToFreeze, uint256 duration)
    public
    {
        address sender = getSender();
        requirePermissions(sender, canFreeze, senderPermsLevel);
        requireNotFrozen(senderPermsLevel);
        uint256 until = SafeMath.add(now, duration);
        uint8 senderLevel = extractLevel(senderPermsLevel);
        require(levelToFreeze <= senderLevel, "level higher than caller");
        require(levelToFreeze >= frozenLevel, "level already frozen");
        require(duration <= maxFreeze, "duration too long");
        require(frozenUntil <= until, "cannot decrease duration");
        require(duration > 0, "duration too short");

        frozenLevel = levelToFreeze;
        frozenUntil = until;
        emit LevelFrozen(frozenLevel, frozenUntil, sender);
        stateNonce++;
    }

    function addOperatorNow(uint32 senderPermsLevel, address newOperatorAddress, uint256 targetStateNonce) public {
        address sender = getSender();
        requirePermissions(sender, canAddOperatorNow, senderPermsLevel);
        requireNotFrozen(senderPermsLevel);
        requireCorrectState(targetStateNonce);
        require(allowAcceleratedCalls, "Call blocked");
        uint8[] memory actions = new uint8[](1);
        bytes32[] memory args = new bytes32[](1);
        actions[0] = uint8(ChangeType.ADD_OPERATOR_NOW);
        args[0] = Utilities.encodeParticipant(newOperatorAddress, ownerPermissions, 1);
        changeConfigurationInternal(actions, args, args, sender, senderPermsLevel, address(0), 0);
    }

    function approveAddOperatorNow(uint32 senderPermsLevel,
        address newOperatorAddress,
        uint256 scheduledStateId,
        address scheduler,
        uint32 schedulerPermsLevel) public {
        address sender = getSender();
        requirePermissions(sender, canApprove, senderPermsLevel);
        requireNotFrozen(senderPermsLevel);
        uint8[] memory actions = new uint8[](1);
        bytes32[] memory args = new bytes32[](1);
        actions[0] = uint8(ChangeType.ADD_OPERATOR_NOW);
        args[0] = Utilities.encodeParticipant(newOperatorAddress, ownerPermissions, 1);
        bytes32 hash = Utilities.transactionHash(actions, args, args, scheduledStateId, scheduler, schedulerPermsLevel, address(0), 0);
        require(pendingChanges[hash].dueTime != 0, "Pending change not found");
        delete pendingChanges[hash];
        participants[args[0]] = true;
        emit ConfigApplied(hash, sender);
        emit ParticipantAdded(newOperatorAddress, ownerPermissions, 1);
        stateNonce++;
    }

    function removeBypassByTarget(uint32 senderPermsLevel, address target) public delegateToBypassLib {
//        bypassLib.delegatecall(msg.data);
    }

    function removeBypassByMethod(uint32 senderPermsLevel, bytes4 method) public delegateToBypassLib {
//        bypassLib.delegatecall(msg.data);
    }

    function boostedConfigChange(
        uint32 boosterPermsLevel,
        uint8[] memory actions,
        bytes32[] memory args1,
        bytes32[] memory args2,
        uint256 targetStateNonce,
        uint32 signerPermsLevel,
        bytes memory signature)
    public {
        address sender = getSender();
        requirePermissions(sender, canExecuteBoosts, boosterPermsLevel);
        requireNotFrozen(boosterPermsLevel);
        requireCorrectState(targetStateNonce);
        address signer = Utilities.recoverConfigSigner(actions, args1, args2, stateNonce, signature);
        requirePermissions(signer, canSignBoosts | canChangeConfig, signerPermsLevel);
        changeConfigurationInternal(actions, args1, args2, signer, signerPermsLevel, sender, boosterPermsLevel);
    }

    function changeConfiguration(
        uint32 senderPermsLevel,
        uint8[] memory actions,
        bytes32[] memory args1,
        bytes32[] memory args2,
        uint256 targetStateNonce)
    public
    {
        address realSender = getSender();
        requirePermissions(realSender, canChangeConfig, senderPermsLevel);
        requireNotFrozen(senderPermsLevel);
        requireCorrectState(targetStateNonce);
        changeConfigurationInternal(actions, args1, args2, realSender, senderPermsLevel, address(0), 0);
    }

    function changeConfigurationInternal(
        uint8[] memory actions,
        bytes32[] memory args1,
        bytes32[] memory args2,
        address sender,
        uint32 senderPermsLevel,
        address booster,
        uint32 boosterPermsLevel
    ) internal {
        bytes32 transactionHash = Utilities.transactionHash(actions, args1, args2, stateNonce, sender, senderPermsLevel, booster, boosterPermsLevel);
        uint256 dueTime = SafeMath.add(now, delays[extractLevel(senderPermsLevel)]);
        pendingChanges[transactionHash] = PendingChange(dueTime, new bytes32[](0));
        emit ConfigPending(transactionHash, sender, senderPermsLevel, booster, boosterPermsLevel, stateNonce, actions, args1, args2, dueTime);
        stateNonce++;
    }

    function scheduleAddOperator(uint32 senderPermsLevel, address newOperator, uint256 targetStateNonce) public {
        requirePermissions(getSender(), canAddOperator, senderPermsLevel);
        requireNotFrozen(senderPermsLevel);
        requireCorrectState(targetStateNonce);
        uint8[] memory actions = new uint8[](1);
        actions[0] = uint8(ChangeType.ADD_OPERATOR);
        bytes32[] memory args = new bytes32[](1);
        args[0] = bytes32(uint256(newOperator));
        changeConfigurationInternal(actions, args, args, getSender(), senderPermsLevel, address(0), 0);
    }

    function cancelOperation(
        uint32 senderPermsLevel,
        uint8[] memory actions,
        bytes32[] memory args1,
        bytes32[] memory args2,
        uint256 scheduledStateId,
        address scheduler,
        uint32 schedulerPermsLevel,
        address booster,
        uint32 boosterPermsLevel)
    public {
        address sender = getSender();
        requirePermissions(sender, canCancel, senderPermsLevel);
        requireNotFrozen(senderPermsLevel);
        bytes32 hash = Utilities.transactionHash(actions, args1, args2, scheduledStateId, scheduler, schedulerPermsLevel, booster, boosterPermsLevel);
        require(pendingChanges[hash].dueTime > 0, "operation does not exist");
        // TODO: refactor, make function or whatever
        if (booster != address(0)) {
            require(extractLevel(boosterPermsLevel) <= extractLevel(senderPermsLevel), "booster is of higher level");
        }
        else {
            require(extractLevel(schedulerPermsLevel) <= extractLevel(senderPermsLevel), "scheduler is of higher level");
        }
        delete pendingChanges[hash];
        emit ConfigCancelled(hash, sender);
        stateNonce++;
    }

    function approveConfig(
        uint32 senderPermsLevel,
        uint8[] memory actions,
        bytes32[] memory args1,
        bytes32[] memory args2,
        uint256 scheduledStateId,
        address scheduler,
        uint32 schedulerPermsLevel,
        address booster,
        uint32 boosterPermsLevel) public {
        address sender = getSender();
        requirePermissions(sender, canApprove, senderPermsLevel);
        requireNotFrozen(senderPermsLevel);
        if (booster != address(0))
        {
            requireNotFrozen(boosterPermsLevel, "booster level is frozen");
        }
        else {
            requireNotFrozen(schedulerPermsLevel, "scheduler level is frozen");
        }
        //TODO add test
        require(extractLevel(schedulerPermsLevel) <= extractLevel(senderPermsLevel), "cannot approve operation from higher level");

        bytes32 transactionHash = Utilities.transactionHash(actions, args1, args2, scheduledStateId, scheduler, schedulerPermsLevel, booster, boosterPermsLevel);
        PendingChange storage pendingChange = pendingChanges[transactionHash];
        require(pendingChange.dueTime != 0, "non existent pending change");
        require(requiredApprovalsPerLevel[extractLevel(schedulerPermsLevel)] > 0, "Level doesn't support approvals");
        bytes32 approver = Utilities.encodeParticipant(sender, senderPermsLevel);
        require(!hasApproved(approver, pendingChange.approvers), "Cannot approve twice");
        //TODO: separate the checks above to different function shared between applyConfig & approveConfig
        pendingChange.approvers.push(approver);
        stateNonce++;

    }

    function applyConfig(
        uint32 senderPermsLevel,
        uint8[] memory actions,
        bytes32[] memory args1,
        bytes32[] memory args2,
        uint256 scheduledStateId,
        address scheduler,
        uint32 schedulerPermsLevel,
        address booster,
        uint32 boosterPermsLevel)
    public {
        address sender = getSender();
        requireParticipant(sender, senderPermsLevel);
        requireNotFrozen(senderPermsLevel);
        if (booster != address(0))
        {
            requireNotFrozen(boosterPermsLevel, "booster level is frozen");
        }
        else {
            requireNotFrozen(schedulerPermsLevel, "scheduler level is frozen");
        }
        bytes32 transactionHash = Utilities.transactionHash(actions, args1, args2, scheduledStateId, scheduler, schedulerPermsLevel, booster, boosterPermsLevel);
        PendingChange memory pendingChange = pendingChanges[transactionHash];
        require(pendingChange.dueTime != 0, "non existent pending change");
        require(now >= pendingChange.dueTime, "before due time");
        // TODO: also, should probably check that all approvers are still participants
        require(pendingChange.approvers.length >= requiredApprovalsPerLevel[extractLevel(schedulerPermsLevel)], "Pending approvals");
        delete pendingChanges[transactionHash];
        for (uint256 i = 0; i < actions.length; i++) {
            dispatch(actions[i], args1[i], args2[i], scheduler, schedulerPermsLevel);
        }
        emit ConfigApplied(transactionHash, sender);
        stateNonce++;
    }

    function dispatch(uint8 actionInt, bytes32 arg1, bytes32 arg2, address sender, uint32 senderPermsLevel) private {
        ChangeType action = ChangeType(actionInt);
        if (action == ChangeType.ADD_PARTICIPANT) {
            addParticipant(sender, senderPermsLevel, arg1);
        }
        else if (action == ChangeType.ADD_OPERATOR) {
            addOperator(sender, senderPermsLevel, address(uint256(arg1)));
        }
        else if (action == ChangeType.REMOVE_PARTICIPANT) {
            removeParticipant(sender, senderPermsLevel, arg1);
        }
        else if (action == ChangeType.UNFREEZE) {
            unfreeze(sender, senderPermsLevel);
        }
        else if (action == ChangeType.ADD_BYPASS_BY_TARGET) {
            addBypassByTarget(sender, senderPermsLevel, address(uint256(arg1) >> 96), BypassPolicy(uint256(arg2) >> 96));
        }
        else if (action == ChangeType.ADD_BYPASS_BY_METHOD) {
            addBypassByMethod(sender, senderPermsLevel, bytes4(arg1), BypassPolicy(uint256(arg2) >> 96));
        }
        else if (action == ChangeType.SET_ACCELERATED_CALLS) {
            setAcceleratedCalls(sender, senderPermsLevel, uint256(arg1) != 0);
        }
        else if (action == ChangeType.ADD_OPERATOR_NOW) {
            revert("Use approveAddOperatorNow instead");
        }
        else {
            revert("operation not supported");
        }
    }


    // ********** Delayed operations below this point

    function addParticipant(address sender, uint32 senderPermsLevel, bytes32 hash) private {
        requirePermissions(sender, canChangeParticipants, senderPermsLevel);
        participants[hash] = true;
        (address participant, uint32 permissions, uint8 level) = Utilities.decodeParticipant(hash);
        emit ParticipantAdded(participant, permissions, level);
    }

    function addOperator(address sender, uint32 senderPermsLevel, address newOperator) private {
        requirePermissions(sender, canAddOperator, senderPermsLevel);
        bytes32 participantId = Utilities.encodeParticipant(newOperator, ownerPermissions, 1);
        participants[participantId] = true;
        emit ParticipantAdded(newOperator, ownerPermissions, 1);
    }

    function addBypassByTarget(address sender, uint32 senderPermsLevel, address target, BypassPolicy bypass) private {
        bytes memory msgData = abi.encodeWithSelector(BypassLib(bypassLib).addBypassByTarget.selector, sender, senderPermsLevel, target, bypass);
        (bool status, bytes memory ret) = bypassLib.delegatecall(msgData);
        require(status, "delegatecall failed");
    }

    function addBypassByMethod(address sender, uint32 senderPermsLevel, bytes4 method, BypassPolicy bypass) private {
        bytes memory msgData = abi.encodeWithSelector(BypassLib(bypassLib).addBypassByMethod.selector, sender, senderPermsLevel, method, bypass);
        (bool status, bytes memory ret) = bypassLib.delegatecall(msgData);
        require(status, "delegatecall failed");
//        bypassLib.addBypassByMethod(sender, senderPermsLevel, method, bypass);
    }

    function removeParticipant(address sender, uint32 senderPermsLevel, bytes32 participantId) private {
        requirePermissions(sender, canChangeParticipants, senderPermsLevel);
        require(participants[participantId], "there is no such participant");
        delete participants[participantId];
        (address participant, uint32 permissions, uint8 level) = Utilities.decodeParticipant(participantId);
        emit ParticipantRemoved(participant, permissions, level);
    }

    function unfreeze(address sender, uint32 senderPermsLevel) private {
        requirePermissions(sender, canUnfreeze, senderPermsLevel);
        frozenLevel = 0;
        frozenUntil = 0;
        emit UnfreezeCompleted();
    }

    function setAcceleratedCalls(address sender, uint32 senderPermsLevel, bool allow) private {
        requirePermissions(sender, canSetAcceleratedCalls, senderPermsLevel);
        allowAcceleratedCalls = allow;
        emit AcceleratedCAllSet(allow);
    }

    //BYPASS SUPPORT
    function scheduleBypassCall(uint32 senderPermsLevel, address target, uint256 value, bytes memory encodedFunction, uint256 targetStateNonce) public delegateToBypassLib {
//        emit DEBUG(bypassLib);
//        bypassLib.delegatecall(msg.data);
//        bypassLib.scheduleBypassCall(senderPermsLevel, target, value, encodedFunction, targetStateNonce);
    }

    function approveBypassCall(
        uint32 senderPermsLevel,
        address scheduler,
        uint32 schedulerPermsLevel,
        uint256 scheduledStateNonce,
        address target,
        uint256 value,
        bytes memory encodedFunction)
    public delegateToBypassLib {
//        bypassLib.delegatecall(msg.data);
//        bypassLib.approveBypassCall(
//            senderPermsLevel,
//                scheduler,
//                schedulerPermsLevel,
//                scheduledStateNonce,
//                target,
//                value,
//                encodedFunction);
    }

    function applyBypassCall(
        uint32 senderPermsLevel,
        address scheduler,
        uint32 schedulerPermsLevel,
        uint256 scheduledStateNonce,
        address target,
        uint256 value,
        bytes memory encodedFunction)
    public delegateToBypassLib {
//        bypassLib.delegatecall(msg.data);
//        bypassLib.applyBypassCall(
//            senderPermsLevel,
//            scheduler,
//            schedulerPermsLevel,
//            scheduledStateNonce,
//            target,
//            value,
//            encodedFunction);
    }

    function cancelBypassCall(
        uint32 senderPermsLevel,
        address scheduler,
        uint32 schedulerPermsLevel,
        uint256 scheduledStateNonce,
        address target,
        uint256 value,
        bytes memory encodedFunction)
    public delegateToBypassLib {
//        bypassLib.delegatecall(msg.data);
//        bypassLib.cancelBypassCall(
//            senderPermsLevel,
//            scheduler,
//            schedulerPermsLevel,
//            scheduledStateNonce,
//            target,
//            value,
//            encodedFunction);
    }

    function executeBypassCall(uint32 senderPermsLevel, address target, uint256 value, bytes memory encodedFunction, uint256 targetStateNonce) public delegateToBypassLib {
//        bypassLib.delegatecall(msg.data);
//        bypassLib.executeBypassCall(senderPermsLevel, target, value, encodedFunction, targetStateNonce);

    }

    /****** Moved over from the Vault contract *******/

    function() payable external {
        emit FundsReceived(msg.value);
    }

    function _acceptCall(address from, bytes memory encodedFunction) view internal returns (uint256 res, bytes memory data){
        uint32 senderRoleRank = uint32(GsnUtils.getParam(encodedFunction, 0));

        // TODO: think more about this 'is creator' thing...
        if (creator == from || isParticipant(from, senderRoleRank)) {
            return (0, "");
        }
        else {
            return (11, "Not a participant");
        }
    }
}

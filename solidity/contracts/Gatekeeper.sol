pragma solidity ^0.5.5;

import "./Vault.sol";
import "./PermissionsLevel.sol";
import "./Utilities.sol";

contract Gatekeeper is PermissionsLevel {

    // Nice idea to use mock token address for ETH instead of 'address(0)'
    address constant internal ETH_TOKEN_ADDRESS = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

    enum ChangeType {
        ADD_PARTICIPANT, // arg: participant_hash
        REMOVE_PARTICIPANT, // arg: participant_hash
        CHOWN, // arg: address
        UNFREEZE            // no args
    }

    //***** events

    event ConfigPending(bytes32 indexed transactionHash, address sender, uint16 senderPermsLevel, address booster, uint16 boosterPermsLevel, uint256 stateId, uint8[] actions, bytes32[] actionsArguments);
    event ConfigCancelled(bytes32 indexed transactionHash, address sender);
// TODO: add 'ConfigApplied' event - this is the simplest way to track what is applied and whatnot
    event ParticipantAdded(bytes32 indexed participant);
    event ParticipantRemoved(bytes32 indexed participant);
    event OwnerChanged(address indexed newOwner);
    // TODO: not log participants
    event GatekeeperInitialized(address vault, bytes32[] participants);
    event LevelFrozen(uint256 frozenLevel, uint256 frozenUntil, address sender);
    event UnfreezeCompleted();
    //*****

    // TODO:
    //  5. Remove 'sender' form non-delayed calls
    // ***********************************

    Vault vault;

    mapping(bytes32 => uint256) public pendingChanges;
    uint256[] public delays;

    function getDelays() public view returns (uint256[] memory) {
        return delays;
    }

    mapping(bytes32 => bool) public participants;
    address public operator;

    uint256 public frozenLevel;
    uint256 public frozenUntil;

    uint256 public stateNonce;

    uint256 public deployedBlock;

    constructor() public {
        deployedBlock = block.number;
    }


    // ********** Access control modifiers below this point

    function requireNotFrozen(uint16 senderPermsLevel, string memory errorMessage) view internal {
        uint8 senderLevel = extractLevel(senderPermsLevel);
        require(now > frozenUntil || senderLevel > frozenLevel, errorMessage);
    }

    function requireNotFrozen(uint16 senderPermsLevel) view internal {
        requireNotFrozen(senderPermsLevel, "level is frozen");
    }

    function requireOneOperator(address participant, uint16 permissions) view internal {
        require(
            permissions != ownerPermissions ||
            participant == operator,
            "not a real operator");
    }

    function requireParticipant(address participant, uint16 permsLevel) view internal {
        require(participants[Utilities.participantHash(participant, permsLevel)], "not participant");
    }

    function requirePermissions(address sender, uint16 neededPermissions, uint16 senderPermsLevel) view internal {
        requireParticipant(sender, senderPermsLevel);
        uint16 senderPermissions = extractPermission(senderPermsLevel);
        requireOneOperator(sender, senderPermissions);
        comparePermissions(neededPermissions, senderPermissions);
    }

    function requireCorrectState(uint256 targetStateNonce) internal {
        require(stateNonce == targetStateNonce, "contract state changed since transaction was created");
    }

    uint constant maxParticipants = 20;
    uint constant maxLevels = 10;
    uint constant maxDelay = 365 days;
    uint constant maxFreeze = 365 days;


    function initialConfig(Vault vaultParam, bytes32[] memory initialParticipants, uint256[] memory initialDelays) public {
        require(operator == address(0), "already initialized");

        require(initialParticipants.length <= maxParticipants, "too many participants");
        require(initialDelays.length <= maxLevels, "too many levels");
        for (uint8 i = 0; i < initialParticipants.length; i++) {
            participants[initialParticipants[i]] = true;
        }
        for (uint8 i = 0; i < initialDelays.length; i++) {
            require(initialDelays[i] < maxDelay, "Delay too long");
        }
        delays = initialDelays;
        vault = vaultParam;

        operator = msg.sender;
        participants[Utilities.participantHash(operator, packPermissionLevel(ownerPermissions, 1))] = true;

        emit GatekeeperInitialized(address(vault), initialParticipants);
        stateNonce++;
    }

    // ****** Immediately runnable functions below this point

    function freeze(uint16 senderPermsLevel, uint8 levelToFreeze, uint duration)
    public
    {
        requirePermissions(msg.sender, canFreeze, senderPermsLevel);
        requireNotFrozen(senderPermsLevel);
        uint until = SafeMath.add(now, duration);
        uint8 senderLevel = extractLevel(senderPermsLevel);
        require(levelToFreeze <= senderLevel, "cannot freeze level that is higher than caller");
        require(levelToFreeze >= frozenLevel, "cannot freeze level that is lower than already frozen");
        require(duration <= maxFreeze, "cannot freeze level for this long");
        require(frozenUntil <= until, "cannot freeze level for less than already frozen");
        require(duration > 0, "cannot freeze level for zero time");

        frozenLevel = levelToFreeze;
        frozenUntil = until;
        emit LevelFrozen(frozenLevel, frozenUntil, msg.sender);
        stateNonce++;
    }

    function boostedConfigChange(uint8[] memory actions, bytes32[] memory args,
        uint256 targetStateNonce, uint16 boosterPermsLevel,
        uint16 signerPermsLevel, bytes memory signature)
    public {
        requirePermissions(msg.sender, canExecuteBoosts, boosterPermsLevel);
        requireNotFrozen(boosterPermsLevel);
        requireCorrectState(targetStateNonce);
        address signer = Utilities.recoverConfigSigner(actions, args, stateNonce, signature);
        requirePermissions(signer, canSignBoosts | canChangeConfig, signerPermsLevel);
        changeConfigurationInternal(actions, args, signer, signerPermsLevel, msg.sender, boosterPermsLevel);
    }


    function changeConfiguration(uint8[] memory actions, bytes32[] memory args, uint256 targetStateNonce, uint16 senderPermsLevel) public
    {
        requirePermissions(msg.sender, canChangeConfig, senderPermsLevel);
        requireNotFrozen(senderPermsLevel);
        requireCorrectState(targetStateNonce);
        changeConfigurationInternal(actions, args, msg.sender, senderPermsLevel, address(0), 0);
    }

    //TODO: Remove after debugging
    event WTF(bytes encodedPacked);
    // Note: this internal method is not wrapped with 'requirePermissions' as it may be called by the 'changeOwner'
    function changeConfigurationInternal(
        uint8[] memory actions, bytes32[] memory args,
        address sender, uint16 senderPermsLevel,
        address booster, uint16 boosterPermsLevel) internal {
        bytes32 transactionHash = Utilities.transactionHash(actions, args, stateNonce, sender, senderPermsLevel, booster, boosterPermsLevel);
        pendingChanges[transactionHash] = SafeMath.add(now, delays[extractLevel(senderPermsLevel)]);
        emit ConfigPending(transactionHash, sender, senderPermsLevel, booster, boosterPermsLevel, stateNonce, actions, args);
        emit WTF(abi.encodePacked(actions, args, stateNonce, sender, senderPermsLevel, booster, boosterPermsLevel));
        stateNonce++;
    }

    function scheduleChangeOwner(uint16 senderPermsLevel, address newOwner, uint256 targetStateNonce) public {
        requirePermissions(msg.sender, canChangeOwner, senderPermsLevel);
        requireNotFrozen(senderPermsLevel);
        requireCorrectState(targetStateNonce);
        uint8[] memory actions = new uint8[](1);
        actions[0] = uint8(ChangeType.CHOWN);
        bytes32[] memory args = new bytes32[](1);
        args[0] = bytes32(uint256(newOwner));
        changeConfigurationInternal(actions, args, msg.sender, senderPermsLevel, address(0), 0);
    }

    function cancelTransfer(uint16 senderPermsLevel, uint256 delay, address destination, uint256 value, address token, uint256 nonce) public {
        requirePermissions(msg.sender, canCancel, senderPermsLevel);
        requireNotFrozen(senderPermsLevel);
        vault.cancelTransfer(delay, destination, value, token, nonce, msg.sender);
        stateNonce++;
    }

    function cancelOperation(
        uint8[] memory actions, bytes32[] memory args, uint256 scheduledStateId,
        address scheduler, uint16 schedulerPermsLevel,
        address booster, uint16 boosterPermsLevel,
        uint16 senderPermsLevel) public {
        requirePermissions(msg.sender, canCancel, senderPermsLevel);
        requireNotFrozen(senderPermsLevel);
        bytes32 hash = Utilities.transactionHash(actions, args, scheduledStateId, scheduler, schedulerPermsLevel, booster, boosterPermsLevel);
        require(pendingChanges[hash] > 0, "cannot cancel, operation does not exist");
        // TODO: refactor, make function or whatever
        if (booster != address(0)) {
            require(extractLevel(boosterPermsLevel) <= extractLevel(senderPermsLevel), "cannot cancel, booster is of higher level");
        }
        else {
            require(extractLevel(schedulerPermsLevel) <= extractLevel(senderPermsLevel), "cannot cancel, scheduler is of higher level");
        }
        delete pendingChanges[hash];
        emit ConfigCancelled(hash, msg.sender);
        stateNonce++;
    }

    function sendEther(address payable destination, uint value, uint16 senderPermsLevel, uint256 delay, uint256 targetStateNonce) public {
        requirePermissions(msg.sender, canSpend, senderPermsLevel);
        requireNotFrozen(senderPermsLevel);
        requireCorrectState(targetStateNonce);
        uint256 levelDelay = delays[extractLevel(senderPermsLevel)];
        require(levelDelay <= delay && delay <= maxDelay, "Invalid delay given");
        vault.scheduleDelayedTransfer(delay, destination, value, ETH_TOKEN_ADDRESS);
        stateNonce++;
    }

    function sendERC20(address payable destination, uint value, uint16 senderPermsLevel, uint256 delay, address token, uint256 targetStateNonce) public {
        requirePermissions(msg.sender, canSpend, senderPermsLevel);
        requireNotFrozen(senderPermsLevel);
        requireCorrectState(targetStateNonce);
        uint256 levelDelay = delays[extractLevel(senderPermsLevel)];
        require(levelDelay <= delay && delay <= maxDelay, "Invalid delay given");
        vault.scheduleDelayedTransfer(delay, destination, value, token);
        stateNonce++;
    }

    function applyConfig(
        uint8[] memory actions, bytes32[] memory args, uint256 scheduledStateId,
        address scheduler, uint16 schedulerPermsLevel,
        address booster, uint16 boosterPermsLevel,
        uint16 senderPermsLevel) public {
        requireParticipant(msg.sender, senderPermsLevel);
        requireNotFrozen(senderPermsLevel);
        if (booster != address(0))
        {
            requireNotFrozen(boosterPermsLevel, "booster level is frozen");
        }
        else {
            requireNotFrozen(schedulerPermsLevel, "scheduler level is frozen");
        }
        bytes32 transactionHash = Utilities.transactionHash(actions, args, scheduledStateId, scheduler, schedulerPermsLevel, booster, boosterPermsLevel);
        uint dueTime = pendingChanges[transactionHash];
        require(dueTime != 0, "apply called for non existent pending change");
        require(now >= dueTime, "apply called before due time");
        for (uint i = 0; i < actions.length; i++) {
            dispatch(actions[i], args[i], scheduler, schedulerPermsLevel);
        }
        // TODO: do this in every method, as a function/modifier
        stateNonce++;
    }

    function applyTransfer(uint256 delay, address payable destination, uint256 value, address token, uint256 nonce, uint16 senderPermsLevel)
    public {
        requireParticipant(msg.sender, senderPermsLevel);
        requireNotFrozen(senderPermsLevel);
        // TODO: test!!!
        vault.applyDelayedTransfer(delay, destination, value, token, nonce, msg.sender);
        stateNonce++;
    }

    function dispatch(uint8 actionInt, bytes32 arg, address sender, uint16 senderPermsLevel) private {
        ChangeType action = ChangeType(actionInt);
        if (action == ChangeType.ADD_PARTICIPANT) {
            addParticipant(sender, senderPermsLevel, arg);
        }
        else if (action == ChangeType.REMOVE_PARTICIPANT) {
            removeParticipant(sender, senderPermsLevel, arg);
        }
        else if (action == ChangeType.CHOWN) {
            changeOwner(sender, senderPermsLevel, address(uint256(arg)));
        }
        else if (action == ChangeType.UNFREEZE) {
            unfreeze(sender, senderPermsLevel);
        }
        else {
            revert("operation not supported");
        }
    }

    // ********** Delayed operations below this point

    function addParticipant(address sender, uint16 senderPermsLevel, bytes32 hash) private {
        requirePermissions(sender, canChangeParticipants, senderPermsLevel);
        participants[hash] = true;
        emit ParticipantAdded(hash);
    }

    function removeParticipant(address sender, uint16 senderPermsLevel, bytes32 participant) private {
        requirePermissions(sender, canChangeParticipants, senderPermsLevel);
        require(participants[participant], "there is no such participant");
        delete participants[participant];
        emit ParticipantRemoved(participant);
    }

    function changeOwner(address sender, uint16 senderPermsLevel, address newOwner) private {
        requirePermissions(sender, canChangeOwner, senderPermsLevel);
        require(newOwner != address(0), "cannot set owner to zero address");
        bytes32 oldParticipant = Utilities.participantHash(operator, packPermissionLevel(ownerPermissions, 1));
        bytes32 newParticipant = Utilities.participantHash(newOwner, packPermissionLevel(ownerPermissions, 1));
        participants[newParticipant] = true;
        delete participants[oldParticipant];
        operator = newOwner;
        emit OwnerChanged(newOwner);
    }

    function unfreeze(address sender, uint16 senderPermsLevel) private {
        requirePermissions(sender, canUnfreeze, senderPermsLevel);
        frozenLevel = 0;
        frozenUntil = 0;
        emit UnfreezeCompleted();
    }

}
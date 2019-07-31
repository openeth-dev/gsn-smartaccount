pragma solidity ^0.5.5;

import "./DelayedOps.sol";
import "./Vault.sol";
import "./PermissionsLevel.sol";
import "openzeppelin-solidity/contracts/cryptography/ECDSA.sol";

contract Gatekeeper is PermissionsLevel {
    using ECDSA for bytes32;

    enum ChangeType {
        ADD_PARTICIPANT, // arg: participant_hash
        REMOVE_PARTICIPANT, // arg: participant_hash
        CHOWN, // arg: address
        UNFREEZE            // no args
    }

    //***** events

    // TODO: remove after merge with Vault w/o DelayedOps
    event DelayedOperation(bytes batchMetadata, uint256 opsNonce, bytes operation, uint dueTime);

    event ConfigPending(bytes32 indexed transactionHash, address sender, uint16 senderPermsLevel, address booster, uint16 boosterPermsLevel, uint256 stateId, uint8[] actions, bytes32[] actionsArguments);
    event ConfigCancelled(bytes32 indexed transactionHash, address sender);

    event ParticipantAdded(bytes32 indexed participant);
    event ParticipantRemoved(bytes32 indexed participant);
    event OwnerChanged(address indexed newOwner);
    // TODO: not log participants
    event GatekeeperInitialized(address vault, bytes32[] participants);
    event LevelFrozen(uint256 frozenLevel, uint256 frozenUntil, address sender);
    event UnfreezeCompleted();
    //*****

    // TODO:
    //  2. Delay per level control (if supported in BizPoC-2)
    //  5. Remove 'sender' form non-delayed calls
    // ***********************************

    //***** events from other contracts for truffle
    event TransactionCompleted(address destination, uint value, address erc20token, uint256 nonce);
    event OperationCancelled(address sender, bytes32 hash);
    //***** </events>

    Vault vault;

    mapping(bytes32 => uint) pendingChanges;
    uint256[] public delays;

    function getDelays() public view returns (uint256[] memory) {
        return delays;
    }

    mapping(bytes32 => bool) public participants;
    address public operator;

    uint256 public frozenLevel;
    uint256 public frozenUntil;

    uint256 public stateId;

    constructor() public {

    }


    // ********** Access control modifiers below this point

    function nonFrozenInternal(uint16 senderPermsLevel, string memory errorMessage) internal {
        uint8 senderLevel = extractLevel(senderPermsLevel);
        require(now > frozenUntil || senderLevel > frozenLevel, errorMessage);
    }

    modifier nonFrozen(uint16 senderPermsLevel) {
        nonFrozenInternal(senderPermsLevel, "level is frozen");
        _;
    }

    function requireOneOperator(address participant, uint16 permissions) internal {
        require(
            permissions != ownerPermissions ||
            participant == operator,
            "not a real operator");
    }

    function requireParticipant(address participant, uint16 permsLevel) internal {
        require(participants[participantHash(participant, permsLevel)], "not participant");
    }

    // Modifiers are added to the stack, so I hit 'stack too deep' a lot. This should be easier on compiler to digest.
    function hasPermissionsInternal(address sender, uint16 neededPermissions, uint16 senderPermsLevel) internal {

        (uint16 senderPermissions, uint8 senderLevel) = extractPermissionLevel(senderPermsLevel);
        requireParticipant(sender, senderPermsLevel);
        requireOneOperator(sender, senderPermissions);
        string memory errorMessage = "not allowed";
        // TODO: fix error messages to include more debug info
        // now this to make older test pass
        if (neededPermissions == canSignBoosts) {
            errorMessage = "boost not allowed";
        }
        requirePermissions(neededPermissions, senderPermissions, errorMessage);
    }

    modifier hasPermissions(address sender, uint16 neededPermissions, uint16 senderPermsLevel) {
        hasPermissionsInternal(sender, neededPermissions, senderPermsLevel);
        _;
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
        participants[participantHash(operator, packPermissionLevel(ownerPermissions, 1))] = true;

        emit GatekeeperInitialized(address(vault), initialParticipants);
    }

    // ****** Immediately runnable functions below this point

    function freeze(uint16 senderPermsLevel, uint8 levelToFreeze, uint interval)
    hasPermissions(msg.sender, canFreeze, senderPermsLevel)
    nonFrozen(senderPermsLevel)
    public
    {
        uint until = SafeMath.add(now, interval);
        uint8 senderLevel = extractLevel(senderPermsLevel);
        require(levelToFreeze <= senderLevel, "cannot freeze level that is higher than caller");
        require(levelToFreeze > frozenLevel, "cannot freeze level that is lower than already frozen");
        require(interval <= maxFreeze, "cannot freeze level for this long");
        require(frozenUntil <= until, "cannot freeze level for less than already frozen");
        require(interval > 0, "cannot freeze level for zero time");

        frozenLevel = levelToFreeze;
        frozenUntil = until;
        emit LevelFrozen(frozenLevel, frozenUntil, msg.sender);
    }

    function boostedConfigChange(uint8[] memory actions, bytes32[] memory args, uint256 targetStateId, uint16 boosterPermsLevel, uint16 signerPermsLevel, bytes memory signature)
    hasPermissions(msg.sender, canExecuteBoosts, boosterPermsLevel)
    nonFrozen(boosterPermsLevel)
    public {
        // TODO: do this in every method, as a function/modifier
        require(stateId == targetStateId, "contract state changed since transaction was created");
        // Signed change doesn't have 'sender' or 'booster' info, as sender == signer and can use different boosters
        bytes32 changeHash = keccak256(abi.encodePacked(actions, args, stateId));
        address signer = changeHash.toEthSignedMessageHash().recover(signature);
        hasPermissionsInternal(signer, canSignBoosts, signerPermsLevel);
        changeConfigurationInternal(actions, args, signer, signerPermsLevel, msg.sender, boosterPermsLevel);
    }


    function changeConfiguration(uint8[] memory actions, bytes32[] memory args, uint256 targetStateId, uint16 senderPermsLevel) public
    hasPermissions(msg.sender, canChangeConfig, senderPermsLevel)
    nonFrozen(senderPermsLevel)
    {
        // TODO: do this in every method, as a function/modifier
        require(stateId == targetStateId, "contract state changed since transaction was created");
        changeConfigurationInternal(actions, args, msg.sender, senderPermsLevel, address(0), 0);
    }

    function changeConfigurationInternal(uint8[] memory actions, bytes32[] memory args, address sender, uint16 senderPermsLevel, address booster, uint16 boosterPermsLevel)
    internal {
        bytes32 transactionHash = keccak256(abi.encodePacked(actions, args, stateId, sender, senderPermsLevel, booster, boosterPermsLevel));
        pendingChanges[transactionHash] = SafeMath.add(now, delays[extractLevel(senderPermsLevel)]);
        emit ConfigPending(transactionHash, sender, senderPermsLevel, booster, boosterPermsLevel, stateId, actions, args);
        // TODO: do this in every method, as a function/modifier
        stateId++;
    }

    function scheduleChangeOwner(uint16 senderPermsLevel, address newOwner)
    hasPermissions(msg.sender, canChangeOwner, senderPermsLevel)
    nonFrozen(senderPermsLevel)
    public {
        uint8[] memory actions = new uint8[](1);
        actions[0] = uint8(ChangeType.CHOWN);
        bytes32[] memory args = new bytes32[](1);
        args[0] = bytes32(uint256(newOwner));
        changeConfigurationInternal(actions, args, msg.sender, senderPermsLevel, address(0), 0);
    }

    function cancelTransfer(uint16 senderPermsLevel, bytes32 hash)
    hasPermissions(msg.sender, canCancel, senderPermsLevel)
    nonFrozen(senderPermsLevel)
    public {
        vault.cancelTransfer(hash);
    }

    function cancelOperation(uint8[] memory actions, bytes32[] memory args, uint256 scheduledStateId, address scheduler, uint16 schedulerPermsLevel, address booster, uint16 boosterPermsLevel, uint16 senderPermsLevel)
    hasPermissions(msg.sender, canCancel, senderPermsLevel)
    nonFrozen(senderPermsLevel)
    public {
        bytes32 hash = keccak256(abi.encodePacked(actions, args, scheduledStateId, scheduler, schedulerPermsLevel, booster, boosterPermsLevel));
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
    }

    function sendEther(address payable destination, uint value, uint16 senderPermsLevel, uint256 delay)
    hasPermissions(msg.sender, canSpend, senderPermsLevel)
    nonFrozen(senderPermsLevel)
    public {
        uint256 levelDelay = delays[extractLevel(senderPermsLevel)];
        require(levelDelay <= delay && delay <= maxDelay, "Invalid delay given");
        vault.scheduleDelayedEtherTransfer(delay, destination, value);
    }

    function sendERC20(address payable destination, uint value, uint16 senderPermsLevel, uint256 delay, address token)
    hasPermissions(msg.sender, canSpend, senderPermsLevel)
    nonFrozen(senderPermsLevel)
    public {
        uint256 levelDelay = delays[extractLevel(senderPermsLevel)];
        require(levelDelay <= delay && delay <= maxDelay, "Invalid delay given");
        vault.scheduleDelayedERC20Transfer(delay, destination, value, token);
    }

    function applyConfig(
        uint8[] memory actions, bytes32[] memory args, uint256 scheduledStateId,
        address scheduler, uint16 schedulerPermsLevel,
        address booster, uint16 boosterPermsLevel,
        uint16 senderPermsLevel)
    nonFrozen(senderPermsLevel)
    public {
        if (booster != address(0))
        {
            nonFrozenInternal(boosterPermsLevel, "booster level is frozen");
        }
        else {
            nonFrozenInternal(schedulerPermsLevel, "scheduler level is frozen");
        }
        bytes32 transactionHash = keccak256(abi.encodePacked(actions, args, scheduledStateId, scheduler, schedulerPermsLevel, booster, boosterPermsLevel));
        uint dueTime = pendingChanges[transactionHash];
        require(dueTime != 0, "apply called for non existent pending change");
        require(now >= dueTime, "apply called before due time");
        for (uint i = 0; i < actions.length; i++) {
            dispatch(actions[i], args[i], scheduler, schedulerPermsLevel);
        }
        // TODO: do this in every method, as a function/modifier
        stateId++;
    }

    function applyTransfer(bytes memory operation, uint256 nonce, uint16 senderPermsLevel)
    public {
        requireParticipant(msg.sender, senderPermsLevel);
        // TODO: test!!!
        vault.applyDelayedTransfer(operation, nonce);
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

    // TODO: obviously does not conceal the level and identity
    function addParticipant(address sender, uint16 senderPermsLevel, bytes32 hash)
    hasPermissions(sender, canChangeParticipants, senderPermsLevel)
    private {
        participants[hash] = true;
        emit ParticipantAdded(hash);
    }

    function removeParticipant(address sender, uint16 senderPermsLevel, bytes32 participant)
    hasPermissions(sender, canChangeParticipants, senderPermsLevel)
    private {
        require(participants[participant], "there is no such participant");
        delete participants[participant];
        emit ParticipantRemoved(participant);
    }

    function changeOwner(address sender, uint16 senderPermsLevel, address newOwner)
    hasPermissions(sender, canChangeOwner, senderPermsLevel)
    private {
        require(newOwner != address(0), "cannot set owner to zero address");
        bytes32 oldParticipant = participantHash(operator, packPermissionLevel(ownerPermissions, 1));
        bytes32 newParticipant = participantHash(newOwner, packPermissionLevel(ownerPermissions, 1));
        participants[newParticipant] = true;
        delete participants[oldParticipant];
        operator = newOwner;
        emit OwnerChanged(newOwner);
    }

    function unfreeze(address sender, uint16 senderPermsLevel)
    hasPermissions(sender, canUnfreeze, senderPermsLevel)
    private {
        frozenLevel = 0;
        frozenUntil = 0;
        emit UnfreezeCompleted();
    }

}
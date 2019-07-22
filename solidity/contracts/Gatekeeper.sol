pragma solidity ^0.5.5;

import "./DelayedOps.sol";
import "./Vault.sol";
import "./PermissionsLevel.sol";
import "openzeppelin-solidity/contracts/cryptography/ECDSA.sol";

contract Gatekeeper is DelayedOps, PermissionsLevel {
    using ECDSA for bytes32;

    //***** events
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
    event TransactionCompleted(address destination, uint value, ERC20 erc20token, uint256 nonce);
    event OperationCancelled(address sender, bytes32 hash);
    //***** </events>

    Vault vault;

    uint256[] public delays;

    function getDelays() public view returns(uint256[] memory) {
        return delays;
    }

    mapping(bytes32 => bool) public participants;
    address public operator;

    uint256 public frozenLevel;
    uint256 public frozenUntil;

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
        //TODO: implement delays
        delays = initialDelays;
        vault = vaultParam;

        operator = msg.sender;
        participants[participantHash(operator, packPermissionLevel(ownerPermissions, 1))] = true;

        emit GatekeeperInitialized(address(vault), initialParticipants);
    }

    //TODO:
    function validateOperation(bytes memory blob, bytes memory singleOp) internal {
        (address senderClaim, uint16 senderPermsLevelClaim) = abi.decode(blob, (address, uint16));
        address senderParam = address(LibBytes.readUint256(singleOp, 4));
        uint256 senderPermsLevelParam = LibBytes.readUint256(singleOp, 36);
        require(senderClaim == senderParam, "claimed sender is incorrect");
        require(senderPermsLevelClaim == senderPermsLevelParam, "claimed permissions are incorrect");
    }

    // ****** Immediately runnable functions below this point

    function freeze(uint16 senderPermsLevel, uint8 levelToFreeze, uint interval)
    hasPermissions(msg.sender, canFreeze, senderPermsLevel)
    nonFrozen(senderPermsLevel)
    public
    {
        uint until = now + interval;
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

    function boostedConfigChange(uint16 boosterPermsLevel, uint16 signerPermsLevel,
        bytes memory batch, bytes memory signature)
    hasPermissions(msg.sender, canExecuteBoosts, boosterPermsLevel)
    nonFrozen(boosterPermsLevel)
    public {
        address signer = keccak256(batch).toEthSignedMessageHash().recover(signature);
        hasPermissionsInternal(signer, canSignBoosts, signerPermsLevel);
        changeConfigurationInternal(signer, signerPermsLevel, msg.sender, boosterPermsLevel, batch);
    }

    function changeConfiguration(uint16 senderPermsLevel, bytes memory batch)
    hasPermissions(msg.sender, canChangeConfig, senderPermsLevel)
    nonFrozen(senderPermsLevel)
    public
    {
        changeConfigurationInternal(msg.sender, senderPermsLevel, address(0), 0, batch);
    }

    // Note: 'nonFrozen' is checked in public methods, as we either need to check the real sender, or the booster
    function changeConfigurationInternal(address sender, uint16 senderPermsLevel, address booster, uint16 boosterPermsLevel, bytes memory batch)
    hasPermissions(sender, canChangeConfig, senderPermsLevel)
    internal {
        bytes memory batchMetadata = abi.encode(sender, senderPermsLevel, booster, boosterPermsLevel);
        scheduleDelayedBatch(batchMetadata, delays[extractLevel(senderPermsLevel)], batch);
    }

    function scheduleChangeOwner(uint16 senderPermsLevel, address newOwner)
    hasPermissions(msg.sender, canChangeOwner, senderPermsLevel)
    nonFrozen(senderPermsLevel)
    public {
        bytes memory batchMetadata = abi.encode(msg.sender, senderPermsLevel, address(0), uint16(0));
        bytes memory delayedTransaction = abi.encodeWithSelector(this.changeOwner.selector, msg.sender, senderPermsLevel, newOwner);
        scheduleDelayedBatch(batchMetadata, delays[extractLevel(senderPermsLevel)], encodeDelayed(delayedTransaction));
    }

    function cancelTransfer(uint16 senderPermsLevel, bytes32 hash)
    hasPermissions(msg.sender, canCancel, senderPermsLevel)
    nonFrozen(senderPermsLevel)
    public {
        vault.cancelTransfer(hash);
    }

    function cancelOperation(uint16 senderPermsLevel, bytes32 hash)
    hasPermissions(msg.sender, canCancel, senderPermsLevel)
    nonFrozen(senderPermsLevel)
    public {
        cancelDelayedOp(hash);
    }

    function sendEther(address payable destination, uint value, uint16 senderPermsLevel)
    hasPermissions(msg.sender, canSpend, senderPermsLevel)
    nonFrozen(senderPermsLevel)
    public {
        vault.scheduleDelayedEtherTransfer(delays[extractLevel(senderPermsLevel)], destination, value);
    }

    function applyBatch(
        address scheduler, uint16 schedulerPermsLevel,
        address booster, uint16 boosterPermsLevel,
        bytes memory operation, uint16 senderPermsLevel, uint256 nonce)
    nonFrozen(senderPermsLevel)
    public {
        if (booster != address(0))
        {
            nonFrozenInternal(boosterPermsLevel, "booster level is frozen");
        }
        else {
            nonFrozenInternal(schedulerPermsLevel, "scheduler level is frozen");
        }
        requireParticipant(msg.sender, senderPermsLevel);
        bytes memory batchMetadata = abi.encode(scheduler, schedulerPermsLevel, booster, boosterPermsLevel);
        applyDelayedOps(batchMetadata, nonce, operation);
    }

    function applyTransfer(bytes memory operation, uint256 nonce, uint16 senderPermsLevel)
    public {
        requireParticipant(msg.sender, senderPermsLevel);
        // TODO: test!!!
        vault.applyDelayedTransfer(operation, nonce);
    }

    // ********** Delayed operations below this point

    // TODO: obviously does not conceal the level and identity
    function addParticipant(address sender, uint16 senderPermsLevel, address newParticipant, uint16 permsLevel)
    hasPermissions(sender, canChangeParticipants, senderPermsLevel) external {
        require(address(this) == msg.sender, "Function can only be called by Gatekeeper");
        bytes32 hash = participantHash(newParticipant, permsLevel);
        participants[hash] = true;
        emit ParticipantAdded(hash);
    }

    function removeParticipant(address sender, uint16 senderPermsLevel, bytes32 participant)
    hasPermissions(sender, canChangeParticipants, senderPermsLevel) external {
        require(address(this) == msg.sender, "Function can only be called by Gatekeeper");
        require(participants[participant], "there is no such participant");
        delete participants[participant];
        emit ParticipantRemoved(participant);
    }

    function changeOwner(address sender, uint16 senderPermsLevel, address newOwner)
    hasPermissions(sender, canChangeOwner, senderPermsLevel)
    external {
        require(address(this) == msg.sender, "Function can only be called by Gatekeeper");
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
    external {
        require(address(this) == msg.sender, "Function can only be called by Gatekeeper");
        frozenLevel = 0;
        frozenUntil = 0;
        emit UnfreezeCompleted();
    }

}
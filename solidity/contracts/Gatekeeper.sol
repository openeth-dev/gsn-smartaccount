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
    event GatekeeperInitialized(address vault);
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

    uint256 delay = 1 hours;


    mapping(bytes32 => bool) public participants;
    address public operator;

    uint256 public frozenLevel;
    uint256 public frozenUntil;

    // ********** Access control modifiers below this point

    function max(uint8 a, uint8 b) private pure returns (uint8) {
        return a > b ? a : b;
    }

    function requireUnfrozen(uint8 senderLevel) internal {
        require(now > frozenUntil || senderLevel > frozenLevel, "level is frozen");
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

    modifier hasPermissions(address sender, uint16 neededPermissions, uint16 senderPermsLevel, uint8 boostedLevel) {
        (uint16 senderPermissions, uint8 senderLevel) = extractPermissionLevel(senderPermsLevel);
        requireUnfrozen(max(senderLevel, boostedLevel));
        requireParticipant(sender, senderPermsLevel);
        requireOneOperator(sender, senderPermissions);
        requirePermissions(neededPermissions, senderPermissions);
        _;
    }

    uint constant maxParticipants = 20;
    uint constant maxLevels = 10;
    uint constant maxDelay = 365 days;
    uint constant maxFreeze = 365 days;

    function initialConfig(Vault vaultParam, bytes32[] memory initialParticipants, uint[] memory initialDelays) public {
        require(operator == address(0), "already initialized");

        require(initialParticipants.length <= maxParticipants, "too many participants");
        require(initialDelays.length <= maxLevels, "too many levels");
        for (uint8 i = 0; i < initialParticipants.length; i++) {
            participants[initialParticipants[i]] = true;
        }
        for (uint8 i = 0; i < initialDelays.length; i++) {
            require(initialDelays[i] < maxDelay);
        }
        //        TODO: implement delays
        //        delays = initialDelays;
        vault = vaultParam;

        operator = msg.sender;
        participants[participantHash(operator, packPermissionLevel(ownerPermissions, 1))] = true;

        emit GatekeeperInitialized(address(vault));
    }

    function validateOperation(address sender, uint256 extraData, bytes4 methodSig) internal {
    }

    // ****** Immediately runnable functions below this point

    function freeze(uint16 permsLevel, uint8 levelToFreeze, uint interval)
    hasPermissions(msg.sender, canFreeze, permsLevel, 0)
    public
    {
        uint until = now + interval;
        (, uint8 senderLevel) = extractPermissionLevel(permsLevel);
        require(levelToFreeze <= senderLevel, "cannot freeze level that is higher than caller");
        require(levelToFreeze > frozenLevel, "cannot freeze level that is lower than already frozen");
        require(interval <= maxFreeze, "cannot freeze level for this long");
        require(frozenUntil <= until, "cannot freeze level for less than already frozen");
        require(interval > 0, "cannot freeze level for zero time");

        frozenLevel = levelToFreeze;
        frozenUntil = until;
        emit LevelFrozen(frozenLevel, frozenUntil, msg.sender);
    }

    function boostedConfigChange(uint16 senderPermsLevel, uint16 signerPermissions, bytes memory batch, bytes memory signature)
    hasPermissions(msg.sender, canExecuteBoosts, senderPermsLevel, 0)
    public {
        bytes32 hashedMessage = keccak256(batch);
        address signer = hashedMessage.toEthSignedMessageHash().recover(signature);
        (, uint8 boosterLevel) = extractPermissionLevel(senderPermsLevel);
        changeConfigurationInternal(signer, signerPermissions, boosterLevel, batch);
    }

    function changeConfiguration(uint16 senderPermissions, bytes memory batch)
    hasPermissions(msg.sender, canChangeConfig, senderPermissions, 0)
    public
    {
        changeConfigurationInternal(msg.sender, senderPermissions, 0, batch);
    }

    function changeConfigurationInternal(address sender, uint16 senderPermissions, uint8 boostedLevel, bytes memory batch)
    hasPermissions(sender, canChangeConfig, senderPermissions, boostedLevel)
    internal {
        scheduleDelayedBatch(msg.sender, senderPermissions, delay, batch);
    }

    function scheduleChangeOwner(uint16 senderPermissions, address newOwner)
    hasPermissions(msg.sender, canChangeOwner, senderPermissions, 0)
    public {
        bytes memory delayedTransaction = abi.encodeWithSelector(this.changeOwner.selector, msg.sender, senderPermissions, newOwner);
        scheduleDelayedBatch(msg.sender, senderPermissions, delay, encodeDelayed(delayedTransaction));
    }

    function changeOwner(address sender, uint16 senderPermissions, address newOwner)
    hasPermissions(sender, canChangeOwner, senderPermissions, 0)
    public {
        require(newOwner != address(0), "cannot set owner to zero address");
        bytes32 oldParticipant = participantHash(operator, packPermissionLevel(ownerPermissions, 1));
        bytes32 newParticipant = participantHash(newOwner, packPermissionLevel(ownerPermissions, 1));
        participants[newParticipant] = true;
        delete participants[oldParticipant];
        operator = newOwner;
        emit OwnerChanged(newOwner);
    }

    function applyTransfer(bytes memory operation, uint256 nonce, uint16 sender_permissions)
    public {
        vault.applyDelayedTransfer(operation, nonce);
    }

    function cancelTransfer(uint16 senderPermissions, bytes32 hash)
    hasPermissions(msg.sender, canCancel, senderPermissions, 0)
    public {
        vault.cancelTransfer(hash);
    }

    function cancelOperation(uint16 senderPermissions, bytes32 hash)
    hasPermissions(msg.sender, canCancel, senderPermissions, 0) public {
        cancelDelayedOp(hash);
    }

    // TODO: RIGHT NOW: add 'scheduler'. (allow any participant to apply)
    function applyBatch(address scheduler, uint16 schedulerPermissions, bytes memory operation, uint16 senderPermissions, uint256 nonce)
    public {
        requireParticipant(msg.sender, senderPermissions);
        applyDelayedOps(scheduler, schedulerPermissions, nonce, operation);
    }

    function sendEther(address payable destination, uint value, uint16 senderPermissions)
    hasPermissions(msg.sender, canSpend, senderPermissions, 0) public {
        vault.scheduleDelayedEtherTransfer(delay, destination, value);
    }

    // ********** Delayed operations below this point

    // TODO: obviously does not conceal the level and identity
    function addParticipant(address sender, uint16 senderPermissions, address participant, uint16 permsLevel)
    hasPermissions(sender, canChangeParticipants, senderPermissions, 0) public {
        bytes32 hash = participantHash(participant, permsLevel);
        participants[hash] = true;
        emit ParticipantAdded(hash);
    }

    function removeParticipant(address sender, uint16 senderPermissions, bytes32 participant)
    hasPermissions(sender, canChangeParticipants, senderPermissions, 0) public {
        require(participants[participant], "there is no such participant");
        delete participants[participant];
        emit ParticipantRemoved(participant);
    }

    function unfreeze()
    public {
        emit UnfreezeCompleted();
    }

}
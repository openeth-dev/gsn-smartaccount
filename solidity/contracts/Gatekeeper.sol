pragma solidity ^0.5.5;

import "tabookey-gasless/contracts/GsnUtils.sol";
import "tabookey-gasless/contracts/IRelayRecipient.sol";

import "./Vault.sol";
import "./PermissionsLevel.sol";
import "./Utilities.sol";
import "./BypassPolicy.sol";
import "@0x/contracts-utils/contracts/src/LibBytes.sol";


contract Gatekeeper is PermissionsLevel, IRelayRecipient {

    using LibBytes for bytes;

    // Nice idea to use mock token address for ETH instead of 'address(0)'
    address constant internal ETH_TOKEN_ADDRESS = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

    enum ChangeType {
        ADD_PARTICIPANT, // arg: participant_hash
        REMOVE_PARTICIPANT, // arg: participant_hash
        ADD_BYPASS_BY_TARGET,
        ADD_BYPASS_BY_METHOD,
        UNFREEZE            // no args
    }

    //***** events

    event ConfigPending(bytes32 indexed transactionHash, address sender, uint16 senderPermsLevel, address booster, uint16 boosterPermsLevel, uint256 stateId, uint8[] actions, bytes32[] actionsArguments1, bytes32[] actionsArguments2);
    event ConfigCancelled(bytes32 indexed transactionHash, address sender);
    // TODO: add 'ConfigApplied' event - this is the simplest way to track what is applied and whatnot
    event ParticipantAdded(bytes32 indexed participant);
    event ParticipantRemoved(bytes32 indexed participant);
    event OwnerChanged(address indexed newOwner);
    // TODO: not log participants
    event GatekeeperInitialized(address vault, bytes32[] participants);
    event LevelFrozen(uint256 frozenLevel, uint256 frozenUntil, address sender);
    event UnfreezeCompleted();
    event BypassByTargetAdded(address target, BypassPolicy bypass);
    event BypassByMethodAdded(bytes4 method, BypassPolicy bypass);
    event BypassByTargetRemoved(address target, BypassPolicy bypass);
    event BypassByMethodRemoved(bytes4 method, BypassPolicy bypass);
    event BypassCallPending(bytes32 indexed bypassHash, uint256 stateNonce, address sender, uint16 senderPermsLevel, address target, uint256 value, bytes msgdata);
    //*****

    // TODO:
    //  5. Remove 'sender' form non-delayed calls
    // ***********************************

    Vault vault;
    DefaultBypassPolicy defaultBypassPolicy = new DefaultBypassPolicy();

    struct PendingChange {
        uint256 dueTime;
        address caller;
        // TODO: fully implement approvals mechanism, like:
        // TODO:  1. removed participant probably should lose all approvals
        // TODO:  2. cannot approve the same call twice, etc.
        bool approved;
    }

    mapping(bytes32 => PendingChange) public pendingChanges;
    uint256[] public delays;
    mapping(address => BypassPolicy) bypassPoliciesByTarget; // instance level bypass exceptions
    mapping(bytes4 => BypassPolicy) bypassPoliciesByMethod; // interface (method sigs) level bypass exceptions
    // TODO: do not call this 'bypass calls', this does not describe what these are.
    mapping(bytes32 => PendingChange) pendingBypassCalls;

    function getDelays() public view returns (uint256[] memory) {
        return delays;
    }

    mapping(bytes32 => bool) public participants;

    uint256 public frozenLevel;
    uint256 public frozenUntil;

    uint256 public stateNonce;

    uint256 public deployedBlock;

    // TODO: implement actual 'trusted forwarder' logic
    address trustedForwarder;

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

    function isParticipant(address participant, uint16 permsLevel) view internal returns (bool) {
        return participants[Utilities.participantHash(participant, permsLevel)];
    }

    function requireParticipant(address participant, uint16 permsLevel) view internal {
        require(isParticipant(participant, permsLevel), "not participant");
    }

    function requirePermissions(address sender, uint16 neededPermissions, uint16 senderPermsLevel) view internal {
        requireParticipant(sender, senderPermsLevel);
        uint16 senderPermissions = extractPermission(senderPermsLevel);
        comparePermissions(neededPermissions, senderPermissions);
    }

    function requireCorrectState(uint256 targetStateNonce) view internal {
        require(stateNonce == targetStateNonce, "contract state changed since transaction was created");
    }

    uint constant maxParticipants = 20;
    uint constant maxLevels = 10;
    uint constant maxDelay = 365 days;
    uint constant maxFreeze = 365 days;


    function initialConfig(Vault vaultParam, bytes32[] memory initialParticipants, uint256[] memory initialDelays, address _trustedForwarder) public {
        require(stateNonce == 0, "already initialized");
        require(initialParticipants.length <= maxParticipants, "too many participants");
        require(initialDelays.length <= maxLevels, "too many levels");

        trustedForwarder = _trustedForwarder;
        for (uint8 i = 0; i < initialParticipants.length; i++) {
            participants[initialParticipants[i]] = true;
        }
        for (uint8 i = 0; i < initialDelays.length; i++) {
            require(initialDelays[i] < maxDelay, "Delay too long");
        }
        delays = initialDelays;
        vault = vaultParam;


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

    // TODO: require approval here; also, call it 'addOperatorImmediatelyDangerously'
    function addOperator(uint16 senderPermsLevel, address operator) public {
        requirePermissions(msg.sender, canAddOperator, senderPermsLevel);
        requireNotFrozen(senderPermsLevel);
        addParticipant(msg.sender, senderPermsLevel, Utilities.participantHash(operator, ownerPermissions));

    }

    function removeBypassByTarget(uint16 senderPermsLevel, address target) public {
        requirePermissions(msg.sender, canChangeBypass, senderPermsLevel);
        requireNotFrozen(senderPermsLevel);
        BypassPolicy bypass = bypassPoliciesByTarget[target];
        delete bypassPoliciesByTarget[target];
        emit BypassByTargetRemoved(target, bypass);
    }

    function removeBypassByMethod(uint16 senderPermsLevel, bytes4 method) public {
        requirePermissions(msg.sender, canChangeBypass, senderPermsLevel);
        requireNotFrozen(senderPermsLevel);
        BypassPolicy bypass = bypassPoliciesByMethod[method];
        delete bypassPoliciesByMethod[method];
        emit BypassByMethodRemoved(method, bypass);
    }

    function boostedConfigChange(uint8[] memory actions, bytes32[] memory args1, bytes32[] memory args2,
        uint256 targetStateNonce, uint16 boosterPermsLevel,
        uint16 signerPermsLevel, bytes memory signature)
    public {
        requirePermissions(msg.sender, canExecuteBoosts, boosterPermsLevel);
        requireNotFrozen(boosterPermsLevel);
        requireCorrectState(targetStateNonce);
        address signer = Utilities.recoverConfigSigner(actions, args1, args2, stateNonce, signature);
        requirePermissions(signer, canSignBoosts | canChangeConfig, signerPermsLevel);
        changeConfigurationInternal(actions, args1, args2, signer, signerPermsLevel, msg.sender, boosterPermsLevel);
    }


    function changeConfiguration(uint16 senderPermsLevel, uint8[] memory actions, bytes32[] memory args1, bytes32[] memory args2, uint256 targetStateNonce) public
    {
        address realSender = getSender();
        requirePermissions(realSender, canChangeConfig, senderPermsLevel);
        requireNotFrozen(senderPermsLevel);
        requireCorrectState(targetStateNonce);
        changeConfigurationInternal(actions, args1, args2, realSender, senderPermsLevel, address(0), 0);
    }

    //TODO: Remove after debugging
    event WTF(bytes encodedPacked);
    // Note: this internal method is not wrapped with 'requirePermissions' as it may be called by the 'changeOwner'
    function changeConfigurationInternal(
        uint8[] memory actions,
        bytes32[] memory args1,
        bytes32[] memory args2,
        address sender,
        uint16 senderPermsLevel,
        address booster,
        uint16 boosterPermsLevel
    ) internal {
        bytes32 transactionHash = Utilities.transactionHash(actions, args1, args2, stateNonce, sender, senderPermsLevel, booster, boosterPermsLevel);
        pendingChanges[transactionHash] = PendingChange(SafeMath.add(now, delays[extractLevel(senderPermsLevel)]), sender, false);
        emit ConfigPending(transactionHash, sender, senderPermsLevel, booster, boosterPermsLevel, stateNonce, actions, args1, args2);
        emit WTF(abi.encodePacked(actions, args1, args2, stateNonce, sender, senderPermsLevel, booster, boosterPermsLevel));
        stateNonce++;
    }

    function cancelTransfer(uint16 senderPermsLevel, uint256 delay, address destination, uint256 value, address token, uint256 nonce) public {
        requirePermissions(msg.sender, canCancel, senderPermsLevel);
        requireNotFrozen(senderPermsLevel);
        vault.cancelTransfer(delay, destination, value, token, nonce, msg.sender);
        stateNonce++;
    }

    function cancelOperation(
        uint8[] memory actions, bytes32[] memory args1, bytes32[] memory args2, uint256 scheduledStateId,
        address scheduler, uint16 schedulerPermsLevel,
        address booster, uint16 boosterPermsLevel,
        uint16 senderPermsLevel) public {
        requirePermissions(msg.sender, canCancel, senderPermsLevel);
        requireNotFrozen(senderPermsLevel);
        bytes32 hash = Utilities.transactionHash(actions, args1, args2, scheduledStateId, scheduler, schedulerPermsLevel, booster, boosterPermsLevel);
        require(pendingChanges[hash].dueTime > 0, "cannot cancel, operation does not exist");
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
        uint8[] memory actions, bytes32[] memory args1, bytes32[] memory args2, uint256 scheduledStateId,
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
        bytes32 transactionHash = Utilities.transactionHash(actions, args1, args2, scheduledStateId, scheduler, schedulerPermsLevel, booster, boosterPermsLevel);
        PendingChange memory pendingChange = pendingChanges[transactionHash];
        require(pendingChange.dueTime != 0, "apply called for non existent pending change");
        require(now >= pendingChange.dueTime, "apply called before due time");
        for (uint i = 0; i < actions.length; i++) {
            dispatch(actions[i], args1[i], args2[i], scheduler, schedulerPermsLevel);
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

    function dispatch(uint8 actionInt, bytes32 arg1, bytes32 arg2, address sender, uint16 senderPermsLevel) private {
        ChangeType action = ChangeType(actionInt);
        if (action == ChangeType.ADD_PARTICIPANT) {
            addParticipant(sender, senderPermsLevel, arg1);
        }
        else if (action == ChangeType.REMOVE_PARTICIPANT) {
            removeParticipant(sender, senderPermsLevel, arg1);
        }
        else if (action == ChangeType.UNFREEZE) {
            unfreeze(sender, senderPermsLevel);
        }
        //TODO
        else if (action == ChangeType.ADD_BYPASS_BY_TARGET) {
            addBypassByTarget(sender, senderPermsLevel, address(uint256(arg1)), BypassPolicy(uint256(arg2)));
        }
        else if (action == ChangeType.ADD_BYPASS_BY_METHOD) {
            addBypassByMethod(sender, senderPermsLevel, bytes4(arg1), BypassPolicy(uint256(arg2)));
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

    function addBypassByTarget(address sender, uint16 senderPermsLevel, address target, BypassPolicy bypass) private {
        requirePermissions(sender, canChangeBypass, senderPermsLevel);
        bypassPoliciesByTarget[target] = bypass;
        emit BypassByTargetAdded(target, bypass);
    }

    function addBypassByMethod(address sender, uint16 senderPermsLevel, bytes4 method, BypassPolicy bypass) private {
        requirePermissions(sender, canChangeBypass, senderPermsLevel);
        bypassPoliciesByMethod[method] = bypass;
        emit BypassByMethodAdded(method, bypass);
    }

    function removeParticipant(address sender, uint16 senderPermsLevel, bytes32 participant) private {
        requirePermissions(sender, canChangeParticipants, senderPermsLevel);
        require(participants[participant], "there is no such participant");
        delete participants[participant];
        emit ParticipantRemoved(participant);
    }

    function unfreeze(address sender, uint16 senderPermsLevel) private {
        requirePermissions(sender, canUnfreeze, senderPermsLevel);
        frozenLevel = 0;
        frozenUntil = 0;
        emit UnfreezeCompleted();
    }

    //BYPASS SUPPORT
    // TODO: "schedule/execute bypass" requires it's own, dedicated permission; this means permLevel size must be >= uint32

    function getBypassPolicy(address target, uint256 value, bytes memory encodedFunction) public view returns (uint256 delay, uint256 requiredConfirmations) {
        BypassPolicy bypass = bypassPoliciesByTarget[target];
        if (address(bypass) == address(0)) {
            bypass = bypassPoliciesByMethod[encodedFunction.readBytes4(0)];
        }
        if (address(bypass) == address(0)) {
            bypass = defaultBypassPolicy;
        }
        // TODO: add 'blockAcceleratedCalls' flag config variable (or not, what do I care :-) )
        return bypass.getBypassPolicy(target, value, encodedFunction);
    }

    function scheduleBypassCall(uint16 senderPermsLevel, address target, uint256 value, bytes memory encodedFunction) public {
        requirePermissions(msg.sender, ownerPermissions, senderPermsLevel);
        requireNotFrozen(senderPermsLevel);

        (uint256 delay, uint256 requiredConfirmations) = getBypassPolicy(target, value, encodedFunction);
        require(requiredConfirmations != uint256(- 1), "Call blocked by policy");
        bytes32 bypassCallHash = Utilities.bypassCallHash(stateNonce, msg.sender, senderPermsLevel, target, value, encodedFunction);
        pendingBypassCalls[bypassCallHash] = PendingChange(SafeMath.add(now, delay), msg.sender, false);
        emit BypassCallPending(bypassCallHash, stateNonce, msg.sender, senderPermsLevel, target, value, encodedFunction);

        stateNonce++;
    }

    function applyBypassCall(address scheduler, uint16 schedulerPermsLevel, uint256 scheduledStateNonce, address target, uint256 value, bytes memory encodedFunction, uint16 senderPermsLevel) public {
        requireParticipant(msg.sender, senderPermsLevel);
        requireNotFrozen(senderPermsLevel);

        bytes32 bypassCallHash = Utilities.bypassCallHash(scheduledStateNonce, scheduler, schedulerPermsLevel, target, value, encodedFunction);
        PendingChange memory pendingBypassCall = pendingBypassCalls[bypassCallHash];
        require(pendingBypassCall.dueTime != 0, "apply called for non existent pending bypass call");
        require(now >= pendingBypassCall.dueTime, "apply called before due time");
        vault.execute(target, value, encodedFunction);

        stateNonce++;
    }

    function executeBypassCall(uint16 senderPermsLevel, address target, uint256 value, bytes memory encodedFunction) public {
        requirePermissions(msg.sender, ownerPermissions, senderPermsLevel);
        requireNotFrozen(senderPermsLevel);

        (uint256 delay, uint256 requiredConfirmations) = getBypassPolicy(target, value, encodedFunction);
        require(requiredConfirmations != uint256(- 1), "Call blocked by policy");
        require(delay == 0, "Call cannot be executed immediately.");
        vault.execute(target, value, encodedFunction);

        stateNonce++;
    }

    /*** Relay Recipient implementation **/

    /**
     * return the relayHub of this contract.
     */
    function getHubAddr() public view returns (address){
        return address(0);
    }

    function getRecipientBalance() public view returns (uint){
        return 0;
    }

    function acceptRelayedCall(
        address relay,
        address from,
        bytes calldata encodedFunction,
        uint256 transactionFee,
        uint256 gasPrice,
        uint256 gasLimit,
        uint256 nonce,
        bytes calldata approvalData,
        uint256 maxPossibleCharge
    )
    external
    view
    returns (uint256, bytes memory){
        (relay, from, encodedFunction, transactionFee, gasPrice, gasLimit, nonce, approvalData, maxPossibleCharge);
        uint16 senderRoleRank = uint16(GsnUtils.getParam(encodedFunction, 0));
        if (isParticipant(from, senderRoleRank)) {
            return (0, "");
        }
        else {
            return (11, "Not vault participant");
        }
    }

    function preRelayedCall(bytes calldata) external returns (bytes32){
        return 0;
    }

    function postRelayedCall(bytes calldata, bool, uint, bytes32) external {
    }

    function getSender() view internal returns (address) {
        if (msg.sender == getHubAddr() || msg.sender == trustedForwarder) {
            // At this point we know that the sender is a trusted IRelayHub, so we trust that the last bytes of msg.data are the verified sender address.
            // extract sender address from the end of msg.data
            return LibBytes.readAddress(msg.data, msg.data.length - 20);
        }
        return msg.sender;
    }
}
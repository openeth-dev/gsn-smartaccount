package com.tabookey.foundation

import com.tabookey.duplicated.ConfigCancelledEventResponse
import com.tabookey.duplicated.ConfigPendingEventResponse
import com.tabookey.duplicated.GatekeeperInitializedEventResponse
import com.tabookey.duplicated.LevelFrozenEventResponse
import com.tabookey.duplicated.OwnerChangedEventResponse
import com.tabookey.duplicated.ParticipantAddedEventResponse
import com.tabookey.duplicated.ParticipantRemovedEventResponse
import com.tabookey.duplicated.UnfreezeCompletedEventResponse
import com.tabookey.duplicated.VaultParticipantTuple
import com.tabookey.duplicated.VaultPermissions
import com.tabookey.duplicated.WTFEventResponse
import com.tabookey.foundation.generated.Gatekeeper
import com.tabookey.foundation.generated.Vault
import org.web3j.crypto.Credentials
import org.web3j.crypto.Hash
import org.web3j.protocol.Web3j
import org.web3j.tx.gas.DefaultGasProvider
import org.web3j.tx.gas.EstimatedGasProvider
import org.web3j.utils.Numeric
import java.math.BigInteger

open class VaultContractInteractor(
        vaultAddress: String,
        gkAddress: String,
        private val web3j: Web3j,
        private val credentials: Credentials,
        val participant: VaultParticipantTuple) {

    val permsLevel = participant.packPermissionLevel()



    private var provider: EstimatedGasProvider = EstimatedGasProvider(web3j, DefaultGasProvider.GAS_PRICE, DefaultGasProvider.GAS_LIMIT)

    private var vault: Vault
    private var gk: Gatekeeper

    init {
        vault = Vault.load(vaultAddress, web3j, credentials, provider)
        gk = Gatekeeper.load(gkAddress, web3j, credentials, provider)
    }

    fun vaultAddress(): String? {
        return vault.contractAddress
    }

    fun gkAddress(): String? {
        return gk.contractAddress
    }

    fun ownerPermissions(): String {
        return VaultPermissions.OWNER_PERMISSIONS.toString()
        // TODO: add test that these are equal
//        return gk.ownerPermissions().send().toString()
    }

    fun adminPermissions(): String {
        return VaultPermissions.ADMIN_PERMISSIONS.toString()
        // TODO: add test that these are equal
//        return gk.adminPermissions().send().toString()
    }

    fun watchdogPermissions(): String {
        return VaultPermissions.WATCHDOG_PERMISSIONS.toString()
        // TODO: add test that these are equal
//        return gk.watchdogPermissions().send().toString()
    }

    fun participantHash(): String {
        return Numeric.toHexString(Hash.sha3(Numeric.hexStringToByteArray(credentials.address) + Numeric.hexStringToByteArray(permsLevel)))
    }

    fun initialConfig(vaultAddress: String, initialParticipants: List<String>, initialDelays: List<String>): String {

        val initialParticipantsByteArray: List<ByteArray> = initialParticipants.map { Numeric.hexStringToByteArray(it) }
        val initialDelaysBigInteger: List<BigInteger> = initialDelays.map {
            if (Numeric.containsHexPrefix(it)) {
                BigInteger(it, 16)
            } else {
                BigInteger(it)
            }
        }
        return gk.initialConfig(vaultAddress, initialParticipantsByteArray, initialDelaysBigInteger).send().transactionHash

    }

    fun freeze(levelToFreeze: Int, duration: String): String {
        return gk.freeze(Numeric.toBigInt(this.permsLevel), levelToFreeze.toBigInteger(), duration.toBigInteger()).send().transactionHash
//        val freezeEvents = gk.getLevelFrozenEvents(receipt)
//        assert(freezeEvents.size == 1)
//        val event = freezeEvents[0]
//        val block = web3j.ethGetBlockByNumber(DefaultBlockParameter.valueOf(receipt.blockNumber), false).send().block
//        assert(levelToFreeze.toBigInteger() == event.frozenLevel)
//        assert(duration.toBigInteger() + block.timestamp == event.frozenUntil)

    }

    //    function boostedConfigChange(uint8[] memory actions, bytes32[] memory args,
    //        uint256 targetStateNonce, uint16 boosterPermsLevel,
    //        uint16 signerPermsLevel, bytes memory signature)
    //    public {

    fun boostedConfigChange(actions: List<String>,
                            args: List<ByteArray>,
                            expectedNonce: String,
                            boosterPermsLevel: String,
                            signerPermsLevel: String,
                            signature: String): String {
        val actionsBigInteger: List<BigInteger> = actions.map { it.toBigInteger(if (Numeric.containsHexPrefix(it)) 16 else 10) }
        val expectedNonceBigInteger = expectedNonce.toBigInteger(if (Numeric.containsHexPrefix(expectedNonce)) 16 else 10)
        return gk.boostedConfigChange(
                actionsBigInteger,
                args, expectedNonceBigInteger, Numeric.toBigInt(boosterPermsLevel), Numeric.toBigInt(signerPermsLevel), Numeric.hexStringToByteArray(signature)).send().transactionHash
//        val configPendingEvents = gk.getConfigPendingEvents(receipt)
//        assert(configPendingEvents.size == 1)
//        val event = configPendingEvents[0]
//        assert(actionsBigInteger.equals(event.actions))
//        assert(argsByteArray.equals(event.actionsArguments))
//        assert(expectedNonceBigInteger.equals(event.stateId))
//        assert(boosterPermsLevel.equals(event.boosterPermsLevel))
//        assert(signerPermsLevel.equals(event.senderPermsLevel))
    }

    //    function changeConfiguration(uint8[] memory actions, bytes32[] memory args, uint256 targetStateNonce, uint16 senderPermsLevel) public
    //    {

    open fun changeConfiguration(actions: List<String>,
                            args: List<ByteArray>,
                            expectedNonce: String): String {
        val actionsBigInteger: List<BigInteger> = actions.map { it.toBigInteger(if (Numeric.containsHexPrefix(it)) 16 else 10) }
        val expectedNonceBigInteger = expectedNonce.toBigInteger(if (Numeric.containsHexPrefix(expectedNonce)) 16 else 10)
        val receipt = gk.changeConfiguration(
                actionsBigInteger, args, expectedNonceBigInteger, Numeric.toBigInt(this.permsLevel)).send()
        return receipt.transactionHash
    }

    //function scheduleChangeOwner(uint16 senderPermsLevel, address newOwner, uint256 targetStateNonce) public {

    fun scheduleChangeOwner(newOwnerAddress: String, expectedNonce: String): String {
        val expectedNonceBigInteger = expectedNonce.toBigInteger(if (Numeric.containsHexPrefix(expectedNonce)) 16 else 10)
        return gk.scheduleChangeOwner(Numeric.toBigInt(this.permsLevel), newOwnerAddress, expectedNonceBigInteger).send().transactionHash
    }

    //function cancelTransfer(uint16 senderPermsLevel, uint256 delay, address destination, uint256 value, address token, uint256 nonce) public {

    fun cancelTransfer(delay: String, destination: String, value: String, tokenAddress: String, nonce: String): String {
        return gk.cancelTransfer(Numeric.toBigInt(this.permsLevel), delay.toBigInteger(), destination, value.toBigInteger(),
                tokenAddress, nonce.toBigInteger()).send().transactionHash
    }

    //    function cancelOperation(
    //        uint8[] memory actions, bytes32[] memory args, uint256 scheduledStateId,
    //        address scheduler, uint16 schedulerPermsLevel,
    //        address booster, uint16 boosterPermsLevel,
    //        uint16 senderPermsLevel) public {

    fun cancelOpertaion(actions: List<String>,
                        args: List<ByteArray>,
                        expectedNonce: String,
                        schedulerAddress: String,
                        schedulerPermsLevel: String,
                        boosterAddress: String,
                        boosterPermsLevel: String): String {
        val actionsBigInteger: List<BigInteger> = actions.map { it.toBigInteger(if (Numeric.containsHexPrefix(it)) 16 else 10) }
        val expectedNonceBigInteger = expectedNonce.toBigInteger(if (Numeric.containsHexPrefix(expectedNonce)) 16 else 10)
        return gk.cancelOperation(actionsBigInteger, args, expectedNonceBigInteger, schedulerAddress, Numeric.toBigInt(schedulerPermsLevel),
                boosterAddress, Numeric.toBigInt(boosterPermsLevel), Numeric.toBigInt(this.permsLevel)).send().transactionHash

    }

    //function sendEther(address payable destination, uint value, uint16 senderPermsLevel, uint256 delay, uint256 targetStateNonce) public {

    fun sendEther(destination: String, value: String, delay: String, expectedNonce: String): String {
        return gk.sendEther(destination, value.toBigInteger(), Numeric.toBigInt(this.permsLevel), delay.toBigInteger(), expectedNonce.toBigInteger()).send().transactionHash
    }

    // function sendERC20(address payable destination, uint value, uint16 senderPermsLevel, uint256 delay, address token, uint256 targetStateNonce) public {
    fun sendERC20(destination: String, value: String, delay: String, tokenAddress: String, expectedNonce: String): String {
        return gk.sendERC20(destination, value.toBigInteger(), Numeric.toBigInt(this.permsLevel), delay.toBigInteger(), tokenAddress, expectedNonce.toBigInteger()).send().transactionHash
    }

    //     function applyConfig(
    //        uint8[] memory actions, bytes32[] memory args, uint256 scheduledStateId,
    //        address scheduler, uint16 schedulerPermsLevel,
    //        address booster, uint16 boosterPermsLevel,
    //        uint16 senderPermsLevel) public {

    fun applyConfig(actions: List<String>,
                    args: List<ByteArray>,
                    expectedNonce: String,
                    schedulerAddress: String,
                    schedulerPermsLevel: String,
                    boosterAddress: String,
                    boosterPermsLevel: String): String {
        val actionsBigInteger: List<BigInteger> = actions.map { it.toBigInteger(if (Numeric.containsHexPrefix(it)) 16 else 10) }
//        val argsByteArray: List<ByteArray> = args.map { Numeric.hexStringToByteArray(it) }
        val expectedNonceBigInteger = expectedNonce.toBigInteger(if (Numeric.containsHexPrefix(expectedNonce)) 16 else 10)
        return gk.applyConfig(actionsBigInteger, args, expectedNonceBigInteger, schedulerAddress, Numeric.toBigInt(schedulerPermsLevel),
                boosterAddress, Numeric.toBigInt(boosterPermsLevel), Numeric.toBigInt(this.permsLevel)).send().transactionHash
    }

    //    function applyTransfer(uint256 delay, address payable destination, uint256 value, address token, uint256 nonce, uint16 senderPermsLevel)
    //    public {

    fun applyTransfer(delay: String, destination: String, value: String, tokenAddress: String, nonce: String): String {
        return gk.applyTransfer(delay.toBigInteger(), destination, value.toBigInteger(), tokenAddress, nonce.toBigInteger(), Numeric.toBigInt(this.permsLevel)).send().transactionHash

    }

    open fun getPendingChangeDueTime(configChangeHash: ByteArray): String {
        return gk.pendingChanges(configChangeHash).send().toString()
    }

    //    uint256[] public delays;

    fun delays(index: Int): String {
        return gk.delays(index.toBigInteger()).send().toString()

    }

    //    function getDelays() public view returns (uint256[] memory) {
    //        return delays;
    //    }

    //
    //    mapping(bytes32 => bool) public participants;

    fun isParticipant(participantHash: String): Boolean {
        return gk.participants(Numeric.hexStringToByteArray(participantHash)).send()
    }

    //    address public operator;

    fun operator(): String {
        return gk.operator().send()
    }

    //    uint256 public frozenLevel;

    fun frozenLevel(): Int {
        return gk.frozenLevel().send().toInt()
    }

    //    uint256 public frozenUntil;

    fun frozenUntil(): String {
        return gk.frozenUntil().send().toString()
    }

    //    uint256 public stateNonce;

    fun stateNonce(base: Int = 10): String {
        return gk.stateNonce().send().toString(base)
    }

    //    uint256 public deployedBlock;

    fun deployedBlock(base: Int = 10): String {
        return gk.deployedBlock().send().toString(base)
    }


    // Blockchain Events getters - wrappers of web3j to be used in kotlin

    open fun getConfigPendingEvent(txHash: String): ConfigPendingEventResponse {
        val receipt = web3j.ethGetTransactionReceipt(txHash).send().transactionReceipt.get()
        val events = Gatekeeper.staticGetConfigPendingEvents(receipt)
        assert(events.size == 1)
        return ConfigPendingEventResponse(events[0].transactionHash, events[0].sender, events[0].senderPermsLevel.toString(16), events[0].booster, events[0].boosterPermsLevel.toString(16), events[0].stateId.toString(), events[0].actions.map { it.toString() }.toMutableList(), events[0].actionsArguments)
    }

    fun getConfigCancelledEvent(txHash: String): ConfigCancelledEventResponse {
        val receipt = web3j.ethGetTransactionReceipt(txHash).send().transactionReceipt.get()
        val events = Gatekeeper.staticGetConfigCancelledEvents(receipt)
        assert(events.size == 1)
        return ConfigCancelledEventResponse(events[0].transactionHash, events[0].sender)
    }

    fun getParticipantAddedEvent(txHash: String): ParticipantAddedEventResponse {
        val receipt = web3j.ethGetTransactionReceipt(txHash).send().transactionReceipt.get()
        val events = Gatekeeper.staticGetParticipantAddedEvents(receipt)
        assert(events.size == 1)
        return ParticipantAddedEventResponse(events[0].participant)
    }

    fun getParticipantRemovedEvent(txHash: String): ParticipantRemovedEventResponse {
        val receipt = web3j.ethGetTransactionReceipt(txHash).send().transactionReceipt.get()
        val events = Gatekeeper.staticGetParticipantRemovedEvents(receipt)
        assert(events.size == 1)
        return ParticipantRemovedEventResponse(events[0].participant)
    }

    fun getOwnerChangedEvent(txHash: String): OwnerChangedEventResponse {
        val receipt = web3j.ethGetTransactionReceipt(txHash).send().transactionReceipt.get()
        val events = Gatekeeper.staticGetOwnerChangedEvents(receipt)
        assert(events.size == 1)
        return OwnerChangedEventResponse(events[0].newOwner)
    }

    fun getGatekeeperInitializedEvent(txHash: String): GatekeeperInitializedEventResponse {
        val receipt = web3j.ethGetTransactionReceipt(txHash).send().transactionReceipt.get()
        val events = Gatekeeper.staticGetGatekeeperInitializedEvents(receipt)
        assert(events.size == 1)
        return GatekeeperInitializedEventResponse(events[0].vault, events[0].participants)
    }

    fun getLevelFrozenEvent(txHash: String): LevelFrozenEventResponse {
        val receipt = web3j.ethGetTransactionReceipt(txHash).send().transactionReceipt.get()
        val events = Gatekeeper.staticGetLevelFrozenEvents(receipt)
        assert(events.size == 1)
        return LevelFrozenEventResponse(events[0].frozenLevel.toString(), events[0].frozenUntil.toString(), events[0].sender)
    }

    fun getUnfreezeCompletedEventResponse(txHash: String): UnfreezeCompletedEventResponse {
        val receipt = web3j.ethGetTransactionReceipt(txHash).send().transactionReceipt.get()
        val events = Gatekeeper.staticGetUnfreezeCompletedEvents(receipt)
        assert(events.size == 1)
        return UnfreezeCompletedEventResponse()
    }

    fun getWTFEventResponse(txHash: String): WTFEventResponse {
        val receipt = web3j.ethGetTransactionReceipt(txHash).send().transactionReceipt.get()
        val events = Gatekeeper.staticGetWTFEvents(receipt)
        assert(events.size == 1)
        return WTFEventResponse(events[0].encodedPacked)
    }

}

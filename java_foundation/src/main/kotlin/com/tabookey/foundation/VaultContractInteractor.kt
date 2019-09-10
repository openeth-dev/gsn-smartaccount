package com.tabookey.foundation

import com.tabookey.duplicated.VaultParticipantTuple
import com.tabookey.duplicated.VaultPermissions
import com.tabookey.foundation.generated.Gatekeeper
import com.tabookey.foundation.generated.Vault
import org.web3j.crypto.Credentials
import org.web3j.crypto.Hash
import org.web3j.protocol.Web3j
import org.web3j.tx.gas.DefaultGasProvider
import org.web3j.tx.gas.EstimatedGasProvider
import org.web3j.utils.Numeric
import java.math.BigInteger

class VaultContractInteractor(
        vaultAddress: String,
        gkAddress: String,
        private val web3j: Web3j,
        private val credentials: Credentials,
        val participant: VaultParticipantTuple) {

    val permsLevel = participant.packPermissionLevel()

    enum class ChangeType(val stringValue: String) {
        ADD_PARTICIPANT("0"), // arg: participant_hash
        REMOVE_PARTICIPANT("1"), // arg: participant_hash
        CHOWN("2"), // arg: address
        UNFREEZE("3")            // no args
    }

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
        return gk!!.initialConfig(vaultAddress, initialParticipantsByteArray, initialDelaysBigInteger).send().transactionHash

    }

    fun freeze(levelToFreeze: Int, duration: String): String {
        return gk.freeze(Numeric.toBigInt(this.permsLevel), levelToFreeze.toBigInteger(), duration.toBigInteger()).send().transactionHash
//        val freezeEvents = gk!!.getLevelFrozenEvents(receipt)
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
                            args: List<String>,
                            expectedNonce: String,
                            boosterPermsLevel: String,
                            signerPermsLevel: String,
                            signature: String): String {
        val actionsBigInteger: List<BigInteger> = actions.map { it.toBigInteger(if (Numeric.containsHexPrefix(it)) 16 else 10) }
        val argsByteArray: List<ByteArray> = args.map { Numeric.hexStringToByteArray(it) }
        val expectedNonceBigInteger = expectedNonce.toBigInteger(if (Numeric.containsHexPrefix(expectedNonce)) 16 else 10)
        return gk!!.boostedConfigChange(
                actionsBigInteger,
                argsByteArray, expectedNonceBigInteger, Numeric.toBigInt(boosterPermsLevel), Numeric.toBigInt(signerPermsLevel), Numeric.hexStringToByteArray(signature)).send().transactionHash
//        val configPendingEvents = gk!!.getConfigPendingEvents(receipt)
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

    fun changeConfiguration(actions: List<String>,
                            args: List<String>,
                            expectedNonce: String): String {
        val actionsBigInteger: List<BigInteger> = actions.map { it.toBigInteger(if (Numeric.containsHexPrefix(it)) 16 else 10) }
        val argsByteArray: List<ByteArray> = args.map { Numeric.hexStringToByteArray(it) }
        val expectedNonceBigInteger = expectedNonce.toBigInteger(if (Numeric.containsHexPrefix(expectedNonce)) 16 else 10)
        val receipt = gk!!.changeConfiguration(
                actionsBigInteger, argsByteArray, expectedNonceBigInteger, Numeric.toBigInt(this.permsLevel)).send()
        return receipt.transactionHash
    }

    //function scheduleChangeOwner(uint16 senderPermsLevel, address newOwner, uint256 targetStateNonce) public {

    fun scheduleChangeOwner(newOwnerAddress: String, expectedNonce: String): String {
        val expectedNonceBigInteger = expectedNonce.toBigInteger(if (Numeric.containsHexPrefix(expectedNonce)) 16 else 10)
        return gk!!.scheduleChangeOwner(Numeric.toBigInt(this.permsLevel), newOwnerAddress, expectedNonceBigInteger).send().transactionHash
    }

    //function cancelTransfer(uint16 senderPermsLevel, uint256 delay, address destination, uint256 value, address token, uint256 nonce) public {

    fun cancelTransfer(delay: String, destination: String, value: String, tokenAddress: String, nonce: String): String {
        return gk!!.cancelTransfer(Numeric.toBigInt(this.permsLevel), delay.toBigInteger(), destination, value.toBigInteger(),
                tokenAddress, nonce.toBigInteger()).send().transactionHash
    }

    //    function cancelOperation(
    //        uint8[] memory actions, bytes32[] memory args, uint256 scheduledStateId,
    //        address scheduler, uint16 schedulerPermsLevel,
    //        address booster, uint16 boosterPermsLevel,
    //        uint16 senderPermsLevel) public {

    fun cancelOpertaion(actions: List<String>,
                        args: List<String>,
                        expectedNonce: String,
                        schedulerAddress: String,
                        schedulerPermsLevel: String,
                        boosterAddress: String,
                        boosterPermsLevel: String): String {
        val actionsBigInteger: List<BigInteger> = actions.map { it.toBigInteger(if (Numeric.containsHexPrefix(it)) 16 else 10) }
        val argsByteArray: List<ByteArray> = args.map { Numeric.hexStringToByteArray(it) }
        val expectedNonceBigInteger = expectedNonce.toBigInteger(if (Numeric.containsHexPrefix(expectedNonce)) 16 else 10)
        return gk!!.cancelOperation(actionsBigInteger, argsByteArray, expectedNonceBigInteger, schedulerAddress, Numeric.toBigInt(schedulerPermsLevel),
                boosterAddress, Numeric.toBigInt(boosterPermsLevel), Numeric.toBigInt(this.permsLevel)).send().transactionHash

    }

    //function sendEther(address payable destination, uint value, uint16 senderPermsLevel, uint256 delay, uint256 targetStateNonce) public {

    fun sendEther(destination: String, value: String, delay: String, expectedNonce: String): String {
        return gk!!.sendEther(destination, value.toBigInteger(), Numeric.toBigInt(this.permsLevel), delay.toBigInteger(), expectedNonce.toBigInteger()).send().transactionHash
    }

    // function sendERC20(address payable destination, uint value, uint16 senderPermsLevel, uint256 delay, address token, uint256 targetStateNonce) public {
    fun sendERC20(destination: String, value: String, delay: String, tokenAddress: String, expectedNonce: String): String {
        return gk!!.sendERC20(destination, value.toBigInteger(), Numeric.toBigInt(this.permsLevel), delay.toBigInteger(), tokenAddress, expectedNonce.toBigInteger()).send().transactionHash
    }

    //     function applyConfig(
    //        uint8[] memory actions, bytes32[] memory args, uint256 scheduledStateId,
    //        address scheduler, uint16 schedulerPermsLevel,
    //        address booster, uint16 boosterPermsLevel,
    //        uint16 senderPermsLevel) public {

    fun applyConfig(actions: List<String>,
                    args: List<String>,
                    expectedNonce: String,
                    schedulerAddress: String,
                    schedulerPermsLevel: String,
                    boosterAddress: String,
                    boosterPermsLevel: String): String {
        val actionsBigInteger: List<BigInteger> = actions.map { it.toBigInteger(if (Numeric.containsHexPrefix(it)) 16 else 10) }
        val argsByteArray: List<ByteArray> = args.map { Numeric.hexStringToByteArray(it) }
        val expectedNonceBigInteger = expectedNonce.toBigInteger(if (Numeric.containsHexPrefix(expectedNonce)) 16 else 10)
        return gk!!.applyConfig(actionsBigInteger, argsByteArray, expectedNonceBigInteger, schedulerAddress, Numeric.toBigInt(schedulerPermsLevel),
                boosterAddress, Numeric.toBigInt(boosterPermsLevel), Numeric.toBigInt(this.permsLevel)).send().transactionHash
    }

    //    function applyTransfer(uint256 delay, address payable destination, uint256 value, address token, uint256 nonce, uint16 senderPermsLevel)
    //    public {

    fun applyTransfer(delay: String, destination: String, value: String, tokenAddress: String, nonce: String): String {
        return gk!!.applyTransfer(delay.toBigInteger(), destination, value.toBigInteger(), tokenAddress, nonce.toBigInteger(), Numeric.toBigInt(this.permsLevel)).send().transactionHash

    }

    //    uint256[] public delays;

    fun delays(index: Int): String {
        return gk!!.delays(index.toBigInteger()).send().toString()

    }

    //    function getDelays() public view returns (uint256[] memory) {
    //        return delays;
    //    }

    //
    //    mapping(bytes32 => bool) public participants;

    fun isParticipant(participantHash: String): Boolean {
        return gk!!.participants(Numeric.hexStringToByteArray(participantHash)).send()
    }

    //    address public operator;

    fun operator(): String {
        return gk!!.operator().send()
    }

    //    uint256 public frozenLevel;

    fun frozenLevel(): Int {
        return gk!!.frozenLevel().send().toInt()
    }

    //    uint256 public frozenUntil;

    fun frozenUntil(): String {
        return gk!!.frozenUntil().send().toString()
    }

    //    uint256 public stateNonce;

    fun stateNonce(base: Int = 10): String {
        return gk!!.stateNonce().send().toString(base)
    }

    //    uint256 public deployedBlock;

    fun deployedBlock(base: Int = 10): String {
        return gk!!.deployedBlock().send().toString(base)
    }

    fun getEvent(name: String) {

    }


}
package com.tabookey.foundation

import com.tabookey.foundation.generated.Gatekeeper
import com.tabookey.foundation.generated.Vault
import com.tabookey.foundation.generated.VaultFactory
import org.web3j.abi.datatypes.Address
import org.web3j.crypto.Credentials
import org.web3j.protocol.Web3j
import org.web3j.protocol.core.DefaultBlockParameter
import org.web3j.tx.gas.DefaultGasProvider
import org.web3j.tx.gas.EstimatedGasProvider
import org.web3j.utils.Numeric
import java.math.BigInteger

class VaultContractInteractor(
        private var vaultFactoryAddress: String,
        var vaultAddress: String?,
        var gkAddress: String?,
        private val web3j: Web3j,
        private val credentials: Credentials) {

    private var provider: EstimatedGasProvider = EstimatedGasProvider(web3j, DefaultGasProvider.GAS_PRICE, DefaultGasProvider.GAS_LIMIT)

    private var vaultFactory: VaultFactory
    private lateinit var vault: Vault
    private lateinit var gk: Gatekeeper

    init {
        vaultFactory = VaultFactory.load(vaultFactoryAddress, web3j, credentials, provider)
        if (vaultAddress != null)
            vault = Vault.load(vaultAddress, web3j, credentials, provider)
        if (gkAddress != null)
            gk = Gatekeeper.load(gkAddress, web3j, credentials, provider)
    }

    companion object {
        fun connect(vaultFactoryAddress: String, vaultAddress: String? = null, gkAddress: String? = null, web3j: Web3j, credentials: Credentials): VaultContractInteractor {
            return VaultContractInteractor(vaultFactoryAddress, vaultAddress, gkAddress, web3j, credentials)
        }
    }

    fun deployNewGatekeeper(): VaultFactory.VaultCreatedEventResponse {
        if (vaultAddress != null || gkAddress != null) {
            throw RuntimeException("vault already deployed")
        }
        val receipt = vaultFactory.newVault().send()
        val vaultCreatedEvents = vaultFactory.getVaultCreatedEvents(receipt)
        assert(vaultCreatedEvents.size == 1)
        val event = vaultCreatedEvents[0]
        vault = Vault.load(event.vault, web3j, credentials, provider)
        gk = Gatekeeper.load(event.gatekeeper, web3j, credentials, provider)
//        vault!!.transferERC20("0xf0d5bc18421fa04d0a2a2ef540ba5a9f04014be3", BigInteger.ONE, Address.DEFAULT.toString(), BigInteger.ONE, Address.DEFAULT.toString()).send()
        return event!!
    }

    fun ownerPermissions(): String {
        return gk.ownerPermissions().send().toString()
    }

    fun adminPermissions(): String {
        return gk.adminPermissions().send().toString()
    }

    fun watchdogPermissions(): String {
        return gk.watchdogPermissions().send().toString()
    }


    fun initialConfig(vaultAddress: String, initialParticipants: List<String>, initialDelays: List<String>) {

        val initialParticipantsByteArray: List<ByteArray> = initialParticipants.map { Numeric.hexStringToByteArray(it) }
        val initialDelaysBigInteger: List<BigInteger> = initialDelays.map {
            if (Numeric.containsHexPrefix(it)) {
                BigInteger(it, 16)
            } else {
                BigInteger(it)
            }
        }
        gk.initialConfig(vaultAddress, initialParticipantsByteArray, initialDelaysBigInteger)
    }

    fun freeze(senderPermsLevel: Int, levelToFreeze: Int, duration: String) {
        val receipt = gk.freeze(senderPermsLevel.toBigInteger(), levelToFreeze.toBigInteger(), duration.toBigInteger()).send()
        val freezeEvents = gk.getLevelFrozenEvents(receipt)
        assert(freezeEvents.size == 1)
        val event = freezeEvents[0]
        val block = web3j.ethGetBlockByNumber(DefaultBlockParameter.valueOf(receipt.blockNumber), false).send().block
        assert(levelToFreeze.toBigInteger() == event.frozenLevel)
        assert(duration.toBigInteger() + block.timestamp == event.frozenUntil)
    }

    //    function boostedConfigChange(uint8[] memory actions, bytes32[] memory args,
    //        uint256 targetStateNonce, uint16 boosterPermsLevel,
    //        uint16 signerPermsLevel, bytes memory signature)
    //    public {

    fun boostedConfigChange(actions: List<String>,
                            args: List<String>,
                            expectedNonce: String,
                            boosterPermsLevel: Int,
                            signerPermsLevel: Int,
                            signature: ByteArray) {
        val actionsBigInteger: List<BigInteger> = actions.map { it.toBigInteger(if (Numeric.containsHexPrefix(it)) 16 else 10) }
        val argsByteArray: List<ByteArray> = args.map { Numeric.hexStringToByteArray(it) }
        val expectedNonceBigInteger = expectedNonce.toBigInteger(if (Numeric.containsHexPrefix(expectedNonce)) 16 else 10)
        val receipt = gk.boostedConfigChange(
                actionsBigInteger,
                argsByteArray, expectedNonceBigInteger, boosterPermsLevel.toBigInteger(), signerPermsLevel.toBigInteger(), signature).send()
        val configPendingEvents = gk.getConfigPendingEvents(receipt)
        assert(configPendingEvents.size == 1)
        val event = configPendingEvents[0]
        assert(actionsBigInteger.equals(event.actions))
        assert(argsByteArray.equals(event.actionsArguments))
        assert(expectedNonceBigInteger.equals(event.stateId))
        assert(boosterPermsLevel.equals(event.boosterPermsLevel))
        assert(signerPermsLevel.equals(event.senderPermsLevel))
    }

    //    function changeConfiguration(uint8[] memory actions, bytes32[] memory args, uint256 targetStateNonce, uint16 senderPermsLevel) public
    //    {

    fun changeConfiguration(actions: List<String>,
                            args: List<String>,
                            expectedNonce: String,
                            senderPermsLevel: Int) {
        val actionsBigInteger: List<BigInteger> = actions.map { it.toBigInteger(if (Numeric.containsHexPrefix(it)) 16 else 10) }
        val argsByteArray: List<ByteArray> = args.map { Numeric.hexStringToByteArray(it) }
        val expectedNonceBigInteger = expectedNonce.toBigInteger(if (Numeric.containsHexPrefix(expectedNonce)) 16 else 10)
        val receipt = gk.changeConfiguration(
                actionsBigInteger, argsByteArray, expectedNonceBigInteger, senderPermsLevel.toBigInteger()).send()
    }

    //function scheduleChangeOwner(uint16 senderPermsLevel, address newOwner, uint256 targetStateNonce) public {

    fun scheduleChangeOwner(senderPermsLevel: Int, newOwnerAddress: String, expectedNonce: String) {
        val expectedNonceBigInteger = expectedNonce.toBigInteger(if (Numeric.containsHexPrefix(expectedNonce)) 16 else 10)
        gk.scheduleChangeOwner(senderPermsLevel.toBigInteger(), newOwnerAddress, expectedNonceBigInteger).send()
    }

    //function cancelTransfer(uint16 senderPermsLevel, uint256 delay, address destination, uint256 value, address token, uint256 nonce) public {

    fun cancelTransfer(senderPermsLevel: Int, delay: String, destination: String, value: String, tokenAddress: String, nonce: String) {
        gk.cancelTransfer(senderPermsLevel.toBigInteger(), delay.toBigInteger(), destination, value.toBigInteger(),
                tokenAddress, nonce.toBigInteger()).send()
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
                        schedulerPermsLevel: Int,
                        boosterAddress: String,
                        boosterPermsLevel: Int,
                        senderPermsLevel: Int) {
        val actionsBigInteger: List<BigInteger> = actions.map { it.toBigInteger(if (Numeric.containsHexPrefix(it)) 16 else 10) }
        val argsByteArray: List<ByteArray> = args.map { Numeric.hexStringToByteArray(it) }
        val expectedNonceBigInteger = expectedNonce.toBigInteger(if (Numeric.containsHexPrefix(expectedNonce)) 16 else 10)
        gk.cancelOperation(actionsBigInteger, argsByteArray, expectedNonceBigInteger, schedulerAddress, schedulerPermsLevel.toBigInteger(),
                boosterAddress, boosterPermsLevel.toBigInteger(), senderPermsLevel.toBigInteger()).send()

    }

    //function sendEther(address payable destination, uint value, uint16 senderPermsLevel, uint256 delay, uint256 targetStateNonce) public {

    fun sendEther(destination: String, value: String, senderPermsLevel: Int, delay: String, expectedNonce: String) {
        gk.sendEther(destination, value.toBigInteger(), senderPermsLevel.toBigInteger(), delay.toBigInteger(), expectedNonce.toBigInteger()).send()
    }

    // function sendERC20(address payable destination, uint value, uint16 senderPermsLevel, uint256 delay, address token, uint256 targetStateNonce) public {
    fun sendERC20(destination: String, value: String, senderPermsLevel: Int, delay: String, tokenAddress: String, expectedNonce: String) {
        gk.sendERC20(destination, value.toBigInteger(), senderPermsLevel.toBigInteger(), delay.toBigInteger(), tokenAddress, expectedNonce.toBigInteger()).send()
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
                    schedulerPermsLevel: Int,
                    boosterAddress: String,
                    boosterPermsLevel: Int,
                    senderPermsLevel: Int
    ){
        val actionsBigInteger: List<BigInteger> = actions.map { it.toBigInteger(if (Numeric.containsHexPrefix(it)) 16 else 10) }
        val argsByteArray: List<ByteArray> = args.map { Numeric.hexStringToByteArray(it) }
        val expectedNonceBigInteger = expectedNonce.toBigInteger(if (Numeric.containsHexPrefix(expectedNonce)) 16 else 10)
        gk.applyConfig(actionsBigInteger, argsByteArray, expectedNonceBigInteger, schedulerAddress, schedulerPermsLevel.toBigInteger(),
                boosterAddress, boosterPermsLevel.toBigInteger(), senderPermsLevel.toBigInteger()).send()
    }

    //    function applyTransfer(uint256 delay, address payable destination, uint256 value, address token, uint256 nonce, uint16 senderPermsLevel)
    //    public {

    fun applyTransfer(delay: String, destination: String, value: String, tokenAddress: String, nonce: String, senderPermsLevel: Int) {
        gk.applyTransfer(delay.toBigInteger(), destination, value.toBigInteger(), tokenAddress, nonce.toBigInteger(), senderPermsLevel.toBigInteger()).send()

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

    fun isParticipant(participantHash: ByteArray): Boolean {
        return gk.participants(participantHash).send()
    }

    //    address public operator;

    fun operator(): String{
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

}
package com.tabookey.foundation

import com.tabookey.duplicated.ChangeType
import com.tabookey.duplicated.VaultParticipantTuple
import com.tabookey.duplicated.VaultPermissions
import com.tabookey.foundation.generated.Gatekeeper
import com.tabookey.foundation.generated.VaultFactory
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.BeforeAll
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.MethodOrderer.OrderAnnotation
import org.junit.jupiter.api.Order
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.TestMethodOrder
import org.junit.jupiter.api.assertThrows
import org.web3j.abi.TypeDecoder
import org.web3j.abi.datatypes.Type
import org.web3j.crypto.Credentials
import org.web3j.crypto.Hash
import org.web3j.protocol.Web3j
import org.web3j.utils.Numeric

@TestMethodOrder(OrderAnnotation::class)
class TestSample {

    class Participant() {

    }

    fun validateConfiguration(participants: List<Participant>) {
//        await this.asyncForEach(participants, async (participant) => {
//            let adminHash = this.bufferToHex(this.participantHash(participant.address, participant.permLevel));
//            let isAdmin = await gatekeeper.participants(adminHash);
//            assert.equal(participant.isParticipant, isAdmin, `admin ${participant.name} isAdmin=${isAdmin}, expected=${participant.isParticipant}`);
//        });
        participants.forEach {
            val adminHash = ""
            val isAdmin = true
        }

    }

    companion object {
        var txHash = ""

        val owner1Creds = Credentials.create("6edf5e2ae718c0abf4be350792b0b5352cda8341ec10ce6b0d77230b92ae17c3") // address 0x1715abd5086a19e770c53b87739820922f2275c3
        val admin1Creds = Credentials.create("84d4ae57ada4a3619df875aaecd67a06463805e2db4cacdec81a962b79e79390") // address 0x682a4e669793dda85eccc1838d33a391ac41fd38
        val watchdog1Creds = Credentials.create("6ea29c4632853bfd778fdca8699ba751292b1ce1dacb6f91cc42cbd44031e970") // address 0xd2ca23837ab36a83fc1a4f41ee4c17d9f5300f88
        val owner2Creds = Credentials.create("44e361aeeecf499d80a465d19bd766496bcc0921fb4c5747a9237cc27b77145e") // address 0x0a30bbc1f9a522dbab1052076ef2219ca3f7f198
        val admin2Creds = Credentials.create("1b8c88c194a422828ffa18fb56844ab42cd80c2ae7d0bd91b84f0250c052e892") // address 0xc927ca0011a135183a9588cd406423c528104676
        val watchdog2Creds = Credentials.create("a775bcfc9c7509a6a1111a103a84ceb5c0a5e37d38c2ce6fd438305e60398cd2") // address 0x8d29024054ec702d3fc30147436d22824ee7cf5a

        lateinit var owner1PermsLevel: String
        lateinit var admin1PermsLevel: String
        lateinit var watchdog1PermsLevel: String
        lateinit var owner2PermsLevel: String
        lateinit var admin2PermsLevel: String
        lateinit var watchdog2PermsLevel: String

        lateinit var owner1Hash: String
        lateinit var admin1Hash: String
        lateinit var watchdog1Hash: String
        lateinit var owner2Hash: String
        lateinit var admin2Hash: String
        lateinit var watchdog2Hash: String

        lateinit var interactorsFactory: InteractorsFactory
        lateinit var vaultFactory: VaultFactory
        lateinit var factoryInteractor: VaultFactoryContractInteractor
        lateinit var owner1Interactor: VaultContractInteractor
        lateinit var admin1Interactor: VaultContractInteractor
        lateinit var watchdog1Interactor: VaultContractInteractor
        lateinit var owner2Interactor: VaultContractInteractor
        lateinit var admin2Interactor: VaultContractInteractor
        lateinit var watchdog2Interactor: VaultContractInteractor

        lateinit var vaultAddress: String
        lateinit var gkAddress: String

        val zeroAddress = "0x0000000000000000000000000000000000000000"
        lateinit var deployKredentials: Kredentials

        fun deployGatekeeper(web3j: Web3j) {
            deployKredentials = Kredentials(deployCreds)
            interactorsFactory = InteractorsFactory(web3j)
            vaultFactory = VaultFactory.deploy(web3j, deployCreds, gasProvider).send()
            factoryInteractor = interactorsFactory.interactorForVaultFactory(deployKredentials, vaultFactory.contractAddress)
            val response = factoryInteractor.deployNewGatekeeper()
            assertEquals(response.gatekeeper!!.length, 42)
            gkAddress = response.gatekeeper!!
            assertEquals(response.vault!!.length, 42)
            vaultAddress = response.vault!!

//            val throws: Throwable = assertThrows("deployed the gatekeeper twice") {
//                factoryInteractor.deployNewGatekeeper()
//            }
//            assertEquals("vault already deployed", throws.message)
        }


        @BeforeAll
        @JvmStatic
        fun before() {
            println("hello!")

            val owner1Kredentials = Kredentials(owner1Creds)
            val admin1Kredentials = Kredentials(admin1Creds)
            val watchdog1Kredentials = Kredentials(watchdog1Creds)
            val owner2Kredentials = Kredentials(owner2Creds)
            val admin2Kredentials = Kredentials(admin2Creds)
            val watchdog2Kredentials = Kredentials(watchdog2Creds)

            val ownerParticipant = VaultParticipantTuple(VaultPermissions.OWNER_PERMISSIONS, 1, owner1Creds.address)
            val adminParticipant = VaultParticipantTuple(VaultPermissions.ADMIN_PERMISSIONS, 1, admin1Creds.address)
            val watchdogParticipant = VaultParticipantTuple(VaultPermissions.WATCHDOG_PERMISSIONS, 1, watchdog1Creds.address)

            deployGatekeeper(web3j)
            owner1Interactor = interactorsFactory.interactorForVault(owner1Kredentials, vaultAddress, gkAddress, ownerParticipant)
            // fund owner
            moneyTransfer(web3j, deployCreds.address, owner1Creds.address, "1000000000000000000".toBigInteger())
            admin1Interactor = interactorsFactory.interactorForVault(
                    gkAddress = gkAddress, vaultAddress = vaultAddress, kredentials = admin1Kredentials, participant = adminParticipant)
            watchdog1Interactor = interactorsFactory.interactorForVault(
                    gkAddress = gkAddress, vaultAddress = vaultAddress, kredentials = watchdog1Kredentials, participant = watchdogParticipant)
            owner2Interactor = interactorsFactory.interactorForVault(
                    gkAddress = gkAddress, vaultAddress = vaultAddress, kredentials = owner2Kredentials, participant = ownerParticipant)
            // fund owner
            moneyTransfer(web3j, deployCreds.address, owner2Creds.address, "1000000000000000000".toBigInteger())
            admin2Interactor = interactorsFactory.interactorForVault(
                    gkAddress = gkAddress, vaultAddress = vaultAddress, kredentials = admin2Kredentials, participant = adminParticipant)
            watchdog2Interactor = interactorsFactory.interactorForVault(
                    gkAddress = gkAddress, vaultAddress = vaultAddress, kredentials = watchdog2Kredentials, participant = watchdogParticipant)

            owner1PermsLevel = owner1Interactor.permsLevel //packPermissionLevel(owner1Interactor.ownerPermissions(), "1")
            admin1PermsLevel = admin1Interactor.permsLevel //packPermissionLevel(admin1Interactor.adminPermissions(), "1")
            watchdog1PermsLevel = watchdog1Interactor.permsLevel //packPermissionLevel(watchdog1Interactor.watchdogPermissions(), "1")
            owner2PermsLevel = owner2Interactor.permsLevel //packPermissionLevel(owner2Interactor.ownerPermissions(), "2")
            admin2PermsLevel = admin2Interactor.permsLevel //packPermissionLevel(admin2Interactor.adminPermissions(), "2")
            watchdog2PermsLevel = watchdog2Interactor.permsLevel //packPermissionLevel(watchdog2Interactor.watchdogPermissions(), "2")

            owner1Hash = owner1Interactor.participantHash() //Numeric.toHexString(Hash.sha3(Numeric.hexStringToByteArray(owner1Creds.address) + Numeric.hexStringToByteArray(owner1PermsLevel)))
            admin1Hash = admin1Interactor.participantHash() //Numeric.toHexString(Hash.sha3(Numeric.hexStringToByteArray(admin1Creds.address) + Numeric.hexStringToByteArray(admin1PermsLevel)))
            watchdog1Hash = watchdog1Interactor.participantHash() //Numeric.toHexString(Hash.sha3(Numeric.hexStringToByteArray(watchdog1Creds.address) + Numeric.hexStringToByteArray(watchdog1PermsLevel)))
            owner2Hash = owner2Interactor.participantHash() //Numeric.toHexString(Hash.sha3(Numeric.hexStringToByteArray(owner2Creds.address) + Numeric.hexStringToByteArray(owner2PermsLevel)))
            admin2Hash = admin2Interactor.participantHash() //Numeric.toHexString(Hash.sha3(Numeric.hexStringToByteArray(admin2Creds.address) + Numeric.hexStringToByteArray(admin2PermsLevel)))
            watchdog2Hash = watchdog2Interactor.participantHash() //Numeric.toHexString(Hash.sha3(Numeric.hexStringToByteArray(watchdog2Creds.address) + Numeric.hexStringToByteArray(watchdog2PermsLevel)))

        }
    }

    @Test
    @Order(1)
    @DisplayName("the newly deployed vault should accept the initial configuration")
    fun setInitialConfiguration() {

        val initialParticipants = listOf<String>(admin1Hash, watchdog1Hash
                /*Numeric.toHexString(owner1Hash)*/) // owner is set automatically as msg.sender in the contract
        val initialDelays = (1..10).map { (it * dayInSec).toString() }

        assert(!owner1Interactor.isParticipant(owner1Hash))
        assert(!owner1Interactor.isParticipant(admin1Hash))
        assert(!owner1Interactor.isParticipant(watchdog1Hash))

        val txHash = owner1Interactor.initialConfig(owner1Interactor.vaultAddress()!!, initialParticipants, initialDelays)
        val receipt = web3j.ethGetTransactionReceipt(txHash).send().transactionReceipt.get()
        val events = Gatekeeper.staticGetGatekeeperInitializedEvents(receipt)
        assert(events.size == 1)
        assert(events[0].vault == vaultAddress)

        assert(owner1Interactor.isParticipant(owner1Hash))
        assert(owner1Interactor.isParticipant(admin1Hash))
        assert(owner1Interactor.isParticipant(watchdog1Hash))

    }

    @Test
    @Order(2)
    @DisplayName("should schedule change configuration - add admin")
    fun scheduleAddAdmin() {
        val actionAddAdmin = ChangeType.ADD_PARTICIPANT.stringValue
        val actions = listOf(actionAddAdmin)
        val args = listOf(Numeric.hexStringToByteArray(admin2Hash))
        val expectedNonce = owner1Interactor.stateNonce()
        txHash = owner1Interactor.changeConfiguration(actions, args, expectedNonce)
//        val wtfe = Gatekeeper.staticGetWTFEvents(receipt)[0].encodedPacked
//        println("wtfe: " + Numeric.toHexString(wtfe))
        val event = owner1Interactor.getConfigPendingEvent(txHash)
        val action = event.actions[0]
        assertEquals(actions[0], action)
        val arg = event.actionsArguments[0]
        assertEquals(Numeric.toHexString(args[0]), Numeric.toHexString(arg))

        assertEquals(expectedNonce, event.stateId)
        assertEquals(owner1PermsLevel, event.senderPermsLevel)
        assertEquals(owner1Creds.address, event.sender)
        val actionWeb3jType = TypeDecoder.instantiateType("uint8[]", actions)
        val argsWeb3jType = TypeDecoder.instantiateType("bytes32[]", args)
        val expectedNonceWeb3jType = TypeDecoder.instantiateType("uint256", expectedNonce)
        val ownerAddressWeb3jType = TypeDecoder.instantiateType("address", owner1Creds.address)
        val ownerPermsLevelWeb3jType = TypeDecoder.instantiateType("uint16", owner1PermsLevel)
        val boosterAddressWeb3jType = TypeDecoder.instantiateType("address", zeroAddress)
        val boosterPermsLevelWeb3jType = TypeDecoder.instantiateType("uint16", "0")

        val parameters: List<Type<Any>> = listOf(actionWeb3jType, argsWeb3jType, expectedNonceWeb3jType, ownerAddressWeb3jType, ownerPermsLevelWeb3jType, boosterAddressWeb3jType, boosterPermsLevelWeb3jType)

        val dataToHash = encodePacked(parameters)
        val scheduledTxHash = Hash.sha3(dataToHash)
        println("wtfa: " + Numeric.prependHexPrefix(dataToHash))
        println("actions: " + actions[0])
        println("args: " + args[0])
        println("expectedNonce: " + expectedNonce)
        println("owner1PermsLevel: " + Numeric.toHexString(owner1PermsLevel.toByteArray()))
        assertEquals(Numeric.prependHexPrefix(scheduledTxHash), Numeric.toHexString(event.transactionHash))
    }

    @Test
    @Order(3)
    @DisplayName("should revert on trying to apply change configuration too early")
    fun applyAddAdminBeforeTime() {
        val event = owner1Interactor.getConfigPendingEvent(txHash)
        val actions = event.actions
        val args = event.actionsArguments
        val expectedNonce = event.stateId
        val delay = owner1Interactor.delays(owner1Interactor.participant.level)
        increaseTime(delay.toLong() - 100, web3j)
        shouldThrow("revert apply called before due time") {
            owner1Interactor.applyConfig(actions, args, expectedNonce, owner1Creds.address, owner1PermsLevel, zeroAddress, "0")
        }
    }

    @Test
    @Order(4)
    @DisplayName("should revert on trying to apply change configuration with incorrect hash")
    fun applyAddAdminWrongNonce() {
        val event = owner1Interactor.getConfigPendingEvent(txHash)
        val actions = event.actions
        val args = event.actionsArguments
        val expectedNonce = (event.stateId.toInt() - 1).toString()
        shouldThrow("revert apply called for non existent pending change") {
            owner1Interactor.applyConfig(actions, args, expectedNonce, owner1Creds.address, owner1PermsLevel, zeroAddress, "0")
        }
    }

    @Test
    @Order(5)
    @DisplayName("should apply change configuration - add admin")
    fun applyAddAdmin() {
        val event = owner1Interactor.getConfigPendingEvent(txHash)
//        val actionAddAdmin = VaultContractInteractor.ChangeType.ADD_PARTICIPANT.stringValue
        val actions = event.actions //listOf(actionAddAdmin)
        val args = event.actionsArguments //listOf(admin2Hash)
        val expectedNonce = event.stateId //(owner1Interactor.stateNonce().toInt() - 1).toString()
//        val txHash = owner1Interactor.changeConfiguration(actions, args, expectedNonce)
//        val receipt = web3j.ethGetTransactionReceipt(txHash).send().transactionReceipt.get()
        val delay = owner1Interactor.delays(owner1Interactor.participant.level)
        increaseTime(delay.toLong(), web3j)
        owner1Interactor.applyConfig(actions, args, expectedNonce, owner1Creds.address, owner1PermsLevel, zeroAddress, "0")
    }

    @Test
    @Order(6)
    @DisplayName("should schedule and cancel change configuration")
    fun scheduleAndCancelAddAdmin() {
        val actionAddAdmin = ChangeType.ADD_PARTICIPANT.stringValue
        val actions = listOf(actionAddAdmin)
        val args = listOf(Numeric.hexStringToByteArray(admin2Hash))
        val expectedNonce = owner1Interactor.stateNonce()
        txHash = owner1Interactor.changeConfiguration(actions, args, expectedNonce)
        val event = owner1Interactor.getConfigPendingEvent(txHash)
        val action = event.actions[0]
        assertEquals(actions[0], action)
        val arg = event.actionsArguments[0]
        assertEquals(Numeric.toHexString(args[0]), Numeric.toHexString(arg))

        assertEquals(expectedNonce, event.stateId)
        assertEquals(owner1PermsLevel, event.senderPermsLevel)
        assertEquals(owner1Creds.address, event.sender)
        val actionWeb3jType = TypeDecoder.instantiateType("uint8[]", actions) //as DynamicArray<Uint8>
        val argsWeb3jType = TypeDecoder.instantiateType("bytes32[]", args) //as DynamicArray<Bytes32>
        val expectedNonceWeb3jType = TypeDecoder.instantiateType("uint256", expectedNonce) //as Uint256
        val ownerAddressWeb3jType = TypeDecoder.instantiateType("address", owner1Creds.address) //as Address
        val ownerPermsLevelWeb3jType = TypeDecoder.instantiateType("uint16", owner1PermsLevel) //as Uint16
        val boosterAddressWeb3jType = TypeDecoder.instantiateType("address", zeroAddress) //as Address
        val boosterPermsLevelWeb3jType = TypeDecoder.instantiateType("uint16", "0") //as Uint16

        val parameters: List<Type<Any>> = listOf(actionWeb3jType, argsWeb3jType, expectedNonceWeb3jType, ownerAddressWeb3jType, ownerPermsLevelWeb3jType, boosterAddressWeb3jType, boosterPermsLevelWeb3jType)

        val dataToHash = encodePacked(parameters)
        val scheduledTxHash = Hash.sha3(dataToHash)
        assertEquals(Numeric.prependHexPrefix(scheduledTxHash), Numeric.toHexString(event.transactionHash))

        shouldThrow("revert apply called before due time") {
            owner1Interactor.applyConfig(event.actions, event.actionsArguments, event.stateId, event.sender, event.senderPermsLevel, event.booster, event.boosterPermsLevel)
        }
        txHash = owner1Interactor.cancelOpertaion(event.actions, event.actionsArguments, event.stateId, event.sender, event.senderPermsLevel, event.booster, event.boosterPermsLevel)
        shouldThrow("revert apply called for non existent pending change") {
            owner1Interactor.applyConfig(event.actions, event.actionsArguments, event.stateId, event.sender, event.senderPermsLevel, event.booster, event.boosterPermsLevel)
        }
    }

    @Test
    @Order(7)
    @DisplayName("should revert on trying to apply change configuration by frozen level")
    fun applyWhileFrozen() {
    }

    @Test
    @DisplayName("should freeze")
    fun freeze() {
//        admin1Interactor.freeze()
    }

    @Test
    @DisplayName("should boost config change")
    fun boostedConfigChange() {
    }

    @Test
    @DisplayName("should change owner")
    fun changeOwner() {
    }

    @Test
    @DisplayName("should cancel transfer")
    fun cancelTransfer() {
    }

    @Test
    @DisplayName("should cancel config change")
    fun cancelOperation() {
    }


}
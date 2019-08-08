package com.tabookey.foundation

import com.tabookey.foundation.generated.VaultFactory
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.BeforeAll
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.web3j.crypto.Credentials
import org.web3j.protocol.Web3j
import org.web3j.protocol.http.HttpService
import org.web3j.tx.gas.StaticGasProvider
import java.math.BigInteger

class TestSample {

    class Participant(){

    }

    fun validateConfiguration(participants: List<Participant>){
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

        val ownerCreds = Credentials.create("6edf5e2ae718c0abf4be350792b0b5352cda8341ec10ce6b0d77230b92ae17c3") // address 0x1715abd5086a19e770c53b87739820922f2275c3
        val admin1Creds = Credentials.create("84d4ae57ada4a3619df875aaecd67a06463805e2db4cacdec81a962b79e79390") // address 0x682a4e669793dda85eccc1838d33a391ac41fd38
        val watchdog1Creds = Credentials.create("6ea29c4632853bfd778fdca8699ba751292b1ce1dacb6f91cc42cbd44031e970") // address 0xd2ca23837ab36a83fc1a4f41ee4c17d9f5300f88

        lateinit var ownerPermsLevel: String
        lateinit var adminPermsLevel: String
        lateinit var watchdogPermsLevel: String



        lateinit var vaultFactory: VaultFactory
        lateinit var ownerInteractor: VaultContractInteractor
        lateinit var adminInteractor: VaultContractInteractor
        lateinit var watchdogInteractor: VaultContractInteractor

        lateinit var vaultAddress: String
        lateinit var gkAddress: String

        fun packPermissionLevel(permissions: String, level: String): String {
            val permInt = permissions.toInt()
            val levelInt = level.toInt()

            assert(permInt <= 0x07FF)
            assert(levelInt <= 0x1F)
            return "0x" + ((levelInt shl 11) + permInt).toString(16)
        }

        fun deployGatekeeper(web3j: Web3j) {
            val response = ownerInteractor.deployNewGatekeeper()
            assertEquals(response.gatekeeper.length, 42)
            gkAddress = response.gatekeeper
            assertEquals(response.vault.length, 42)
            vaultAddress = response.vault

            val throws: Throwable = assertThrows("deployed the gatekeeper twice") {
                ownerInteractor.deployNewGatekeeper()
            }
            assertEquals("vault already deployed", throws.message)
        }

        @BeforeAll
        @JvmStatic
        fun before() {
            println("hello!")
            val url = "http://localhost:8545"
            val httpService = HttpService(url)
            val web3j = Web3j.build(httpService)
            val ganachePrivateKey = "4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d"
            val creds = Credentials.create(ganachePrivateKey)
            val gasProvider = StaticGasProvider(BigInteger.valueOf(1), BigInteger.valueOf(10_000_000L))
            vaultFactory = VaultFactory.deploy(web3j, creds, gasProvider).send()
            ownerInteractor = VaultContractInteractor.connect(vaultFactoryAddress = vaultFactory.contractAddress, web3j = web3j, credentials = creds)
            deployGatekeeper(web3j)
            adminInteractor = VaultContractInteractor.connect(vaultFactoryAddress = vaultFactory.contractAddress,
                    web3j = web3j, gkAddress = gkAddress, vaultAddress = vaultAddress, credentials = admin1Creds)
            watchdogInteractor = VaultContractInteractor.connect(vaultFactoryAddress = vaultFactory.contractAddress,
                    web3j = web3j, gkAddress = gkAddress, vaultAddress = vaultAddress, credentials = watchdog1Creds)

            ownerPermsLevel = packPermissionLevel(ownerInteractor.ownerPermissions(),"1")
            adminPermsLevel = packPermissionLevel(adminInteractor.adminPermissions(),"1")
            watchdogPermsLevel = packPermissionLevel(watchdogInteractor.watchdogPermissions(),"1")

        }
    }

    @Test
    @DisplayName("the newly deployed vault should accept the initial configuration")
    fun setInitialConfiguration(){

        val initialParticipants = listOf<String>()
        val initialDelays = listOf<String>()
        ownerInteractor.initialConfig(ownerInteractor.vaultAddress!!, initialParticipants, initialDelays)

    }

    @Test
    @DisplayName("should add admin & watchdog")
    fun addParticipants() {
    }

    @Test
    @DisplayName("should freeze")
    fun freeze() {
        adminInteractor.freeze()
    }

    @Test
    @DisplayName("should boost config change")
    fun boostedConfigChange() {
    }



}
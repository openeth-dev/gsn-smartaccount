package com.tabookey.foundation

import com.tabookey.foundation.generated.Gatekeeper
import com.tabookey.foundation.generated.Vault
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

        lateinit var vaultFactory: VaultFactory
        lateinit var vault: Vault
        lateinit var gatekeeper: Gatekeeper
        lateinit var interactor: VaultContractInteractor

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
            interactor = VaultContractInteractor.connect(vaultFactory = vaultFactory, web3j = web3j, credentials = creds)
        }
    }

    @Test
    @DisplayName("deploys a new vault, but only if not initialized")
    fun deployGatekeeper() {
        val response = interactor.deployNewGatekeeper()
        assertEquals(response.gatekeeper.length, 42)
        assertEquals(response.vault.length, 42)

        val throws: Throwable = assertThrows("deployed the gatekeeper twice") {
            interactor.deployNewGatekeeper()
        }
        assertEquals("vault already deployed", throws)
    }

    @Test
    @DisplayName("the newly deployed vault should accept the initial configuration")
    fun setInitialConfiguration(){

        val vaultAddress = vault.contractAddress
        val initialParticipants = listOf<String>()
        val initialDelays = listOf<String>()
        interactor.initialConfig(vaultAddress, initialParticipants, initialDelays)

    }

}
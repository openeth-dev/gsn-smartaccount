package com.tabookey.safechannels

import com.tabookey.safechannels.vault.VaultState
import com.tabookey.safechannels.vault.VaultStorageInterface
import org.web3j.crypto.ECKeyPair
import org.web3j.crypto.Keys
import org.web3j.utils.Numeric

/**
 * The real implementation (and, thus, integration tests) of the persistent storage should be located in the clients.
 * Do not test this class, use it to test the SafeChannels
 */
open class InMemoryStorage : VaultStorageInterface {
    private val keypairs = ArrayList<ECKeyPair>()
    private val vaultsStates = ArrayList<VaultState>()


    /**
     * The state of the vault, both local and cached from blockchain, must be stored. Not the instance itself.
     * Note that [com.tabookey.safechannels.vault.VaultInstance] adds the Vault's API method and 'wraps' the state.
     */
    override fun putVaultState(vault: VaultState) {
        vaultsStates.add(vault)
    }

    override fun getAllVaultsStates(): List<VaultState> {
        return vaultsStates
    }


    override fun getAllOwnedAccounts(): List<String> {
        return keypairs.map { Keys.getAddress(it) }
    }

    /**
     * @return address of the new account
     */
    override fun generateKeypair(): String {
        val kp = Keys.createEcKeyPair()
        keypairs.add(kp)
        return Keys.getAddress(kp)
    }

    /**
     * @param transactionHash
     * @param address
     */
    override fun sign(transactionHash: String, address: String): String {
        val key = keypairs.find { Keys.getAddress(it) == address } ?: throw Exception("Key not found")
        val transactionHashBytes = Numeric.hexStringToByteArray(transactionHash)
        @Suppress("UnnecessaryVariable")
        val signature = key.sign(transactionHashBytes).toString()
        return signature
    }

    override fun getStuff() {
    }

    override fun putStuff() {
    }
}
package com.tabookey.safechannels

import com.tabookey.safechannels.addressbook.AddressBookEntry
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

    private val keypairs = HashMap<Int, ECKeyPair>()
    private val vaultsStates = HashMap<Int, VaultState>()
    private val addressBook = HashMap<Int, AddressBookEntry>()

    private var keypairsId = 0
    private var vaultsStatesId = 0
    private var addressBookId = 0

    override fun putAddressBookEntry(entry: AddressBookEntry): Int {
        addressBook[addressBookId] = entry
        return addressBookId++
    }

    override fun getAddressBookEntries(): List<AddressBookEntry> {
        return addressBook.values.toList()
    }
    /**
     * The state of the vault, both local and cached from blockchain, must be stored. Not the instance itself.
     * Note that [com.tabookey.safechannels.vault.VaultInstance] adds the Vault's API method and 'wraps' the state.
     */
    override fun putVaultState(vault: VaultState): Int {
        vaultsStates[vaultsStatesId] = vault
        return vaultsStatesId++
    }

    override fun getAllVaultsStates(): List<VaultState> {
        return vaultsStates.values.toList()
    }


    override fun getAllOwnedAccounts(): List<String> {
        return keypairs.values.map { Keys.getAddress(it) }
    }

    /**
     * @return address of the new account
     */
    override fun generateKeypair(): String {
        val kp = Keys.createEcKeyPair()
        keypairs[keypairsId] = kp
        return Keys.getAddress(kp)
    }

    /**
     * @param transactionHash
     * @param address
     */
    override fun sign(transactionHash: String, address: String): String {
        val key = keypairs.values.find { Keys.getAddress(it) == address } ?: throw Exception("Key not found")
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
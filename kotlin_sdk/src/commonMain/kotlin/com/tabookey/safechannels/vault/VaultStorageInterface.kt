package com.tabookey.safechannels.vault

import com.tabookey.duplicated.IKredentials
import com.tabookey.safechannels.addressbook.SafechannelContact

interface VaultStorageInterface {

    fun getAllOwnedAccounts(): List<IKredentials>

    fun generateKeypair(): IKredentials
    fun sign(transactionHash: String, address: String): String

    fun putVaultState(vaultState: VaultState)

    fun putAddressBookEntry(contact: SafechannelContact)

    // It is up to the SDK to construct the
    fun getAllVaultsStates(): List<VaultState>

    fun getAddressBookEntries(): List<SafechannelContact>

    fun getStuff()
    fun putStuff()

    enum class Entity{
        VAULT
    }

    /**
     * I want objects to have sequential IDs within their type, but can be UUIDs as well.
     * Cannot rely on database to generate them, as
     * a) not guaranteed to be SQL and b) objects created long before they are stored
     */
    fun getNextId(entity: Entity): Int

}
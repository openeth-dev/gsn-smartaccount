package com.tabookey.safechannels.vault

import com.tabookey.safechannels.addressbook.AddressBookEntry

interface VaultStorageInterface {

    fun getAllOwnedAccounts(): List<String>

    fun generateKeypair(): String
    fun sign(transactionHash: String, address: String): String

    fun putVaultState(vault: VaultState): Int

    /**
     * @return id of the new entry
     */
    fun putAddressBookEntry(entry: AddressBookEntry): Int

    // It is up to the SDK to construct the
    fun getAllVaultsStates(): List<VaultState>

    fun getAddressBookEntries(): List<AddressBookEntry>

    fun getStuff()
    fun putStuff()

}
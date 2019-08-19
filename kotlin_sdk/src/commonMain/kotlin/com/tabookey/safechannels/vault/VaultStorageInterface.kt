package com.tabookey.safechannels.vault

import com.tabookey.safechannels.addressbook.AddressBookEntry
import com.tabookey.safechannels.addressbook.SafechannelContact

interface VaultStorageInterface {

    fun getAllOwnedAccounts(): List<String>

    fun generateKeypair(): String
    fun sign(transactionHash: String, address: String): String

    fun putVaultState(vault: VaultState): Int

    fun putAddressBookEntry(contact: SafechannelContact)

    // It is up to the SDK to construct the
    fun getAllVaultsStates(): List<VaultState>

    fun getAddressBookEntries(): List<SafechannelContact>

    fun getStuff()
    fun putStuff()

}
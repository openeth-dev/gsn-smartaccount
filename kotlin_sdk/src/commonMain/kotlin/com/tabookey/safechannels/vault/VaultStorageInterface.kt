package com.tabookey.safechannels.vault

import com.tabookey.duplicated.IKredentials
import com.tabookey.safechannels.addressbook.SafechannelContact

interface VaultStorageInterface {

    fun getAllOwnedAccounts(): List<IKredentials>

    fun generateKeypair(): IKredentials
    fun sign(transactionHash: String, address: String): String

    fun putVaultState(vault: VaultState): Int

    fun putAddressBookEntry(contact: SafechannelContact)

    // It is up to the SDK to construct the
    fun getAllVaultsStates(): List<VaultState>

    fun getAddressBookEntries(): List<SafechannelContact>

    fun getStuff()
    fun putStuff()

}
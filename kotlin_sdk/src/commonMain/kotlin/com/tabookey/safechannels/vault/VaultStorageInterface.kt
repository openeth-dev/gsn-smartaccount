package com.tabookey.safechannels.vault

interface VaultStorageInterface {

    fun getAllOwnedAccounts(): List<String>

    fun generateKeypair(): String
    fun sign(transactionHash: String, address: String): String

    fun putVaultState(vault: VaultState)

    // It is up to the SDK to construct the
    fun getAllVaultsStates(): List<VaultState>

    fun getStuff()
    fun putStuff()

}
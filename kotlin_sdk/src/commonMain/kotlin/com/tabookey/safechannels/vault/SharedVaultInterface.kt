package com.tabookey.safechannels.vault

import com.tabookey.safechannels.addressbook.AddressBookEntry
import com.tabookey.safechannels.addressbook.EthereumAddress

/**
 * This class represents the logic of chaining the change methods calls in order to construct the desired vault state
 * Also, it holds the state. This logic is shared between deployed and 'under construction' vaults
 * TODO: note: I DO NOT THINK CHAINING IS NEEDED HERE, AS THIS IS NOT A 'DEVELOPER' API AND THIS WILL BE TRIGGERED BY USERS IN UI
 */
abstract class SharedVaultInterface(
        val storageInterface: VaultStorageInterface,
        internal open val vaultState: VaultState) {

    fun getVaultLocalState(): VaultState {
        return vaultState
    }

    // all config tasks here, i.e. like this one
    fun addParticipant(participant: EthereumAddress, permissions: VaultPermissions): SharedVaultInterface {
        vaultState.addLocalChange(LocalVaultChange.addParticipant(participant, permissions))
        storageInterface.putVaultState(vaultState)
        return this
    }

    fun removeParticipant(participant: AddressBookEntry): VaultConfigBuilder {
        TODO()
    }

    fun changeOwner(participant: AddressBookEntry): VaultConfigBuilder {
        TODO()
    }

    fun discardAllChanges() {

    }

    fun discardLocalChange(change: LocalVaultChange) {

    }

}
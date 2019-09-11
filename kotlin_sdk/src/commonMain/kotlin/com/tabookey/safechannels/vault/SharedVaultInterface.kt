package com.tabookey.safechannels.vault

import com.tabookey.duplicated.VaultPermissions
import com.tabookey.safechannels.addressbook.AddressBookEntry
import com.tabookey.safechannels.addressbook.EthereumAddress

/**
 * This class represents the logic of chaining the change methods calls in order to construct the desired vault state
 * Also, it holds the state. This logic is shared between deployed and 'under construction' vaults
 * TODO: note: I DO NOT THINK CHAINING IS NEEDED HERE, AS THIS IS NOT A 'DEVELOPER' API AND THIS WILL BE TRIGGERED BY USERS IN UI
 */
abstract class SharedVaultInterface(
        internal val storage: VaultStorageInterface,
        internal open val vaultState: VaultState) {

    fun getVaultLocalState(): VaultState {
        return vaultState
    }

    // all config tasks here, i.e. like this one
    fun addParticipant(participant: EthereumAddress, permissions: VaultPermissions): LocalVaultChange {
        val change = LocalVaultChange.addParticipant(participant, permissions)
        vaultState.addLocalChange(change)
        storage.putVaultState(vaultState)
        return change
    }

    fun removeParticipant(participant: AddressBookEntry): VaultConfigBuilder {
        TODO()
    }

    fun changeOwner(participant: AddressBookEntry): VaultConfigBuilder {
        TODO()
        // also, in case of not deployed vault/participant, REMOVE and CHOWN are not ADDED TO LIST, but cancel-out the previous ones
    }

    fun discardAllChanges() {

    }

    fun discardLocalChange(change: LocalVaultChange) {

    }

}
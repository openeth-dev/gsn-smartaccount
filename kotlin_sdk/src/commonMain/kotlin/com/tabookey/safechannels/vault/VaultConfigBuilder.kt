package com.tabookey.safechannels.vault

import com.tabookey.safechannels.addressbook.AddressBookEntry

/**
 * Class represents the local state of the Vault before it has been deployed.
 * It can be converted to the [DeployedVault] once by deploying it to the blockchain.
 */
class VaultConfigBuilder : VaultInstance(VaultState()) {

    init {
        vaultState.addLocalChange(LocalVaultChange(LocalChangeType.INITIALIZE))
    }

    /**
     * Blocks for as the deployment time and then returns the [DeployedVault] instance with the correct initial config
     */
    fun deployVault(): DeployedVault {
        TODO()
    }

    // all config tasks here, i.e. like this one
    fun addParticipant(participant: AddressBookEntry, permissions: VaultPermissions): VaultConfigBuilder {
        vaultState.addLocalChange(LocalVaultChange.addParticipant(participant, permissions))
        return this
    }

    fun removeParticipant(participant: AddressBookEntry): VaultConfigBuilder {
        TODO()
    }

    fun changeOwner(participant: AddressBookEntry): VaultConfigBuilder {
        TODO()
    }


}
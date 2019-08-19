package com.tabookey.safechannels.vault

import com.tabookey.safechannels.addressbook.EthereumAddress
import com.tabookey.safechannels.addressbook.VaultParticipantTuple

/**
 * Class represents the local state of the Vault before it has been deployed.
 * It can be converted to the [DeployedVault] once by deploying it to the blockchain.
 */
class VaultConfigBuilder(storage: VaultStorageInterface, vaultState: VaultState)
    : SharedVaultInterface(storage, vaultState) {

    constructor(
            owner: EthereumAddress,
            storage: VaultStorageInterface,
            initialDelays: List<Int>) : this(storage, VaultState()) {

        vaultState.addLocalChange(LocalVaultChange.initialize())
        vaultState.addLocalChange(LocalVaultChange.changeOwner(owner))
        vaultState.activeParticipant = VaultParticipantTuple(VaultPermissions.OWNER_PERMISSIONS, 1, owner)
    }

    /**
     * Blocks for as the deployment time and then returns the [DeployedVault] instance with the correct initial config
     */
    fun deployVault(): DeployedVault {
        TODO()
    }


}
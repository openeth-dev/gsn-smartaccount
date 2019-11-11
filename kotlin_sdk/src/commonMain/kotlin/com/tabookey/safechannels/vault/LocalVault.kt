package com.tabookey.safechannels.vault

import com.tabookey.duplicated.IKredentials
import com.tabookey.duplicated.VaultParticipant
import com.tabookey.duplicated.VaultPermissions
import com.tabookey.safechannels.addressbook.AddressBook
import com.tabookey.safechannels.platforms.InteractorsFactory
import com.tabookey.safechannels.vault.localchanges.LocalChangeType
import com.tabookey.safechannels.vault.localchanges.LocalVaultChange

/**
 * Class represents the local state of the Vault before it has been deployed.
 * It can be converted to the [DeployedVault] once by deploying it to the blockchain.
 */
class LocalVault(
        private val interactorsFactory: InteractorsFactory,
        private val kredentials: IKredentials,
        private val addressBook: AddressBook,
        storage: VaultStorageInterface,
        vaultState: VaultState)
    : SharedVaultInterface(storage, vaultState) {

    constructor(
            vaultId: Int,
            interactorsFactory: InteractorsFactory,
            addressBook: AddressBook,
            kredentials: IKredentials,
            storage: VaultStorageInterface,
            initialDelays: List<Int>) : this(interactorsFactory, kredentials, addressBook, storage, VaultState(vaultId)) {

        val owner = kredentials.getAddress()
        vaultState.addLocalChange(LocalVaultChange.initialize(owner))
        vaultState.activeParticipant = VaultParticipant(VaultPermissions.OWNER_PERMISSIONS, 1, owner)
    }

    /**
     * Blocks for the deployment time and then returns the [DeployedVault] instance with the correct initial config
     */
    suspend fun deployVault(): DeployedVault {
        val factoryContractInteractor = interactorsFactory.interactorForVaultFactory(kredentials)
        val deploymentResult = factoryContractInteractor.deployNewGatekeeper()
        // TODO: the state of the deployed vault should represent the desired config
        vaultState.localChanges.forEach {
            when (it.changeType) {
                LocalChangeType.INITIALIZE -> {
                }//TODO()
                LocalChangeType.ADD_PARTICIPANT -> {
                }//TODO()
                else -> {
                    throw RuntimeException("Unsupported for non-deployed vaults")
                } //TODO()
            }
        }
        vaultState.removeChangesStagedForRemoval()
        vaultState.address = deploymentResult.vault
        vaultState.gatekeeperAddress = deploymentResult.gatekeeper

        val participant = vaultState.activeParticipant
        val interactor = interactorsFactory.interactorForVault(
                kredentials,
                deploymentResult.vault,
                deploymentResult.gatekeeper,
                // TODO: anything but this:
                participant)
        return DeployedVault(interactor, addressBook, storage, vaultState)
    }


}
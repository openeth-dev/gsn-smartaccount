package com.tabookey.safechannels

import com.tabookey.safechannels.vault.VaultStorageInterface.Entity.*
import com.tabookey.duplicated.IKredentials
import com.tabookey.duplicated.VaultPermissions
import com.tabookey.safechannels.addressbook.AddressBook
import com.tabookey.safechannels.addressbook.EthereumAddress
import com.tabookey.safechannels.platforms.InteractorsFactory
import com.tabookey.safechannels.vault.*

/**
 * Wallet-dev will create an instance of SafeChannels and provide it with the platform-specific dependencies
 */
class SafeChannels(
        private val interactorsFactory: InteractorsFactory,
        private val storage: VaultStorageInterface
) {

    private val addressBook = AddressBook(storage)

    private val localVaults = mutableListOf<LocalVault>()
    private val deployedVaults = mutableListOf<DeployedVault>()

    fun createLocalVault(owner: EthereumAddress): LocalVault {
        val ownedAccounts = listAllOwnedAccounts()
        val kredentials = ownedAccounts.findLast { it.getAddress() == owner }
                ?: throw RuntimeException("Unknown account passed as owner")
        val nextId = storage.getNextId(VAULT)
        val localVault = LocalVault(nextId, interactorsFactory, kredentials, storage, emptyList())
        localVaults.add(localVault)
        return localVault
    }

    fun exportPrivateKey(): String {
        TODO()
    }

    fun importPrivateKey() {

    }

    /**
     *
     * @return public key of the newly generated keypair
     */
    fun createKeypair(): IKredentials {
        return storage.generateKeypair()
    }

    /**
     * Note: We will need this when we support multiple accounts, account per role, etc.
     * This is better to support multiple accounts from day 1.
     */
    fun listAllOwnedAccounts(): List<IKredentials> {
        return storage.getAllOwnedAccounts()
    }

    /**
     * To add the vault to the list of active, for example, when you are made a guardian
     */
    fun importExistingVault(
            vaultAddress: String,
            permissions: VaultPermissions,
            level: Int,
            account: String): DeployedVault {
        TODO()
    }

    /**
     * Well, this returns a collection that mixes types. Not perfect.
     * Also! Should only construct an interactor for a
     */
    fun loadAllVaultsFromStorage(): List<SharedVaultInterface> {
        val allVaultsStates = storage.getAllVaultsStates()
        return allVaultsStates.map { vaultState ->
            val kreds = storage.getAllOwnedAccounts().first { it.getAddress() == vaultState.activeParticipant.address }
            if (vaultState.isDeployed) {
                // TODO: anything but this!!!
                val interactor = interactorsFactory.interactorForVault(
                        kreds,
                        vaultState.address!!,
                        vaultState.gatekeeperAddress!!,
                        vaultState.activeParticipant)
                DeployedVault(interactor, storage, vaultState)
            } else {
                LocalVault(interactorsFactory, kreds, storage, vaultState)
            }
        }
    }

    fun removeVault(vault: DeployedVault) {
        TODO()
    }

    fun getAddressBook(): AddressBook {
        return addressBook
    }

    fun saveLocalState() {
        localVaults.forEach {
            storage.putVaultState(it.vaultState)
        }
    }

}
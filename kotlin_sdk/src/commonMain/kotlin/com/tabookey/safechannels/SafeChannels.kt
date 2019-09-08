package com.tabookey.safechannels

import com.tabookey.duplicated.IKredentials
import com.tabookey.duplicated.VaultPermissions
import com.tabookey.safechannels.addressbook.AddressBook
import com.tabookey.safechannels.addressbook.EthereumAddress
import com.tabookey.safechannels.platforms.InteractorsFactory
import com.tabookey.safechannels.platforms.VaultFactoryContractInteractor
import com.tabookey.safechannels.vault.*

/**
 * Clients will create an instance of SafeChannels and provide it with the platform-specific dependencies
 * @param vaultFactoryContractInteractor - is needed to instantiate new vaults
 */
class SafeChannels(
        private val interactorsFactory: InteractorsFactory,
        private val vaultFactoryContractInteractor: VaultFactoryContractInteractor,
        private val storage: VaultStorageInterface
) {

    private val addressBook = AddressBook(storage)

    fun vaultConfigBuilder(owner: EthereumAddress): VaultConfigBuilder {
        val ownedAccounts = listAllOwnedAccounts()
        if (!ownedAccounts.map { it.getAddress() }.contains(owner)) {
            // I think the SDK should start without any accounts for safety reasons.
            throw RuntimeException("Unknown account passed as owner")
        }
        val vaultConfigBuilder = VaultConfigBuilder(interactorsFactory, vaultFactoryContractInteractor, owner, storage, emptyList())
        val state = storage.putVaultState(vaultConfigBuilder.getVaultLocalState())
        vaultConfigBuilder.vaultState.id = state
        return vaultConfigBuilder
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
     */
    fun listAllVaults(): List<SharedVaultInterface> {
        val allVaultsStates = storage.getAllVaultsStates()
        return allVaultsStates.map { vaultState ->
            if (vaultState.isDeployed) {
                // TODO: anything but this!!!
                val kreds = storage.getAllOwnedAccounts().first { it.getAddress() == vaultState.activeParticipant.address }
                val interactor = interactorsFactory.interactorForVault(
                        kreds,
                        vaultState.address!!,
                        vaultState.gatekeeperAddress!!,
                        vaultState.activeParticipant)
                DeployedVault(interactor, storage, vaultState)
            } else {
                VaultConfigBuilder(interactorsFactory, vaultFactoryContractInteractor, storage, vaultState)
            }
        }
    }

    fun removeVault(vault: DeployedVault) {
        TODO()
    }

    fun getAddressBook(): AddressBook {
        return addressBook
    }

}
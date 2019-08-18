package com.tabookey.safechannels

import com.tabookey.safechannels.addressbook.AddressBook
import com.tabookey.safechannels.vault.*

/**
 * Clients will create an instance of SafeChannels and provide it with the platform-specific dependencies
 * @param vaultFactoryContractInteractor - is needed to instantiate new vaults
 */
class SafeChannels(
        private val vaultFactoryContractInteractor: VaultFactoryContractInteractor,
        private val storage: VaultStorageInterface
) {

    private val addressBook = AddressBook(storage)

    companion object {
        fun createVaultFactory(address: String): VaultFactoryContractInteractor {
            return VaultFactoryContractInteractor()
        }
    }

    fun vaultConfigBuilder(): VaultConfigBuilder {
        val vaultConfigBuilder = VaultConfigBuilder()
        storage.putVaultState(vaultConfigBuilder.getVaultState())
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
    fun createKeypair(): String {
        return storage.generateKeypair()
    }

    /**
     * Note: We will need this when we support multiple accounts, account per role, etc.
     * This is better to support multiple accounts from day 1.
     */
    fun listAllOwnedAccounts(): List<String> {
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

    fun listAllVaults(): List<VaultInstance> {
        val allVaultsStates = storage.getAllVaultsStates()
        return allVaultsStates.map { VaultInstance(it) }
    }

    fun removeVault(vault: DeployedVault) {
        TODO()
    }

    fun getAddressBook(): AddressBook {
        return addressBook
    }

}
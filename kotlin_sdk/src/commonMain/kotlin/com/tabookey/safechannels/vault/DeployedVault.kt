package com.tabookey.safechannels.vault

import com.tabookey.safechannels.VaultContractInteractor
import com.tabookey.safechannels.addressbook.VaultParticipantTuple
import com.tabookey.safechannels.blockchain.BlockchainTransaction

/**
 *
 *
 * @param vaultState - if there is something that is already known about this vault (cached or whatever), this data
 *                      should be passed in as a constructor parameter
 */
class DeployedVault(
        val interactor: VaultContractInteractor,
        storage: VaultStorageInterface,
        // Not sure about this 'override val' crap. The idea was to have 'local state'
        // and 'local vault' be superclasses to corresponding 'deployed state' and 'deployed vault',
        // but seems over-engineered.
        override val vaultState: VaultState) : SharedVaultInterface(storage, vaultState) {

    fun getVaultState(): VaultState {
        return vaultState
    }

    fun subscribeToVaultEvents(callback: (List<VaultEvent>) -> Unit) {

    }

    fun unsubscribeFromVaultEvents() {

    }

    // all money-related operations
    fun transferEth(): LocalVaultChange {
        TODO()
    }

    fun freeze(): BlockchainTransaction {
        TODO()
    }

    fun unfreeze(): LocalVaultChange {
        TODO()
    }

    fun signBoostedConfigurationChange(change: List<LocalVaultChange>): String {
        TODO()
    }

    fun commitLocalChanges(): PendingChange {
        TODO()
    }

    fun importConfigurationChangeForBoost(signedChange: String): LocalVaultChange {
        TODO()
    }

    fun cancelPendingChange(change: PendingChange): BlockchainTransaction {
        TODO()
    }

    fun getTransactionsHistory(): List<HistoryEntry> {
        TODO()
    }

    fun getConfigurationHistory(): List<HistoryEntry> {
        TODO()
    }
}
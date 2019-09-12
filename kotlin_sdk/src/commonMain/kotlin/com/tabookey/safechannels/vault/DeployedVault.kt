package com.tabookey.safechannels.vault

import com.tabookey.safechannels.blockchain.BlockchainTransaction
import com.tabookey.safechannels.platforms.VaultContractInteractor

/**
 *
 *
 * @param vaultState - if there is something that is already known about this vault (cached or whatever), this data
 *                      should be passed in as a constructor parameter
 */
class DeployedVault(
        private val interactor: VaultContractInteractor,
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

    fun commitLocalChanges(expectedNonce: String): PendingChange {
        val batchedOperation = object {
            val actions = mutableListOf<String>()
            val args = mutableListOf<String>()
        }
        vaultState.localChanges
                .forEach {
                    batchedOperation.actions.add(it.changeType.ordinal.toString())
                    batchedOperation.args.add(it.getStringArgs())
                }

        val txHash = interactor.changeConfiguration(batchedOperation.actions, batchedOperation.args, expectedNonce)
        val event = interactor.getConfigPendingEvent(txHash)
        val dueTime = interactor.getPendingChangeDueTime(event.transactionHash)
        return PendingChange(BlockchainTransaction(txHash), event, dueTime)
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
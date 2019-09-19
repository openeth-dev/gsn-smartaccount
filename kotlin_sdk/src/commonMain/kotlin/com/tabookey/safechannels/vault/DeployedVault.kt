package com.tabookey.safechannels.vault

import com.tabookey.safechannels.blockchain.BlockchainTransaction
import com.tabookey.safechannels.platforms.VaultContractInteractor
import com.tabookey.safechannels.vault.localchanges.EtherTransferChange
import com.tabookey.safechannels.vault.localchanges.LocalChangeType
import com.tabookey.safechannels.vault.localchanges.LocalVaultChange

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

    // The default one does not increase the delay
    fun transferEth(amountToTransfer: String, destination: String): LocalVaultChange {
        val change = LocalVaultChange.transferEther(amountToTransfer, destination)
        storeChange(change)
        return change
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

    /**
     * Batched op is a short-lived object. It represents a collection of changes that
     * will be submitted in a single blockchain vault transaction.
     */
    class BatchedOperation {
        val size: Int
        get(){
            return actions.size
        }
        val actions = mutableListOf<String>()
        val args = mutableListOf<ByteArray>()

        fun add(change: LocalVaultChange) {
            actions.add(change.contractActionValue)
            args.add(change.arg)
        }
    }

    /**
     * Transfers are not batched and therefore return multiple
     * transactions increment [expectedNonce] for every one of them
     */
    fun commitLocalTransfers(expectedNonce: String): List<PendingChange> {
        var expectedNonceInt = expectedNonce.toInt()
        val allChanges = mutableListOf<PendingChange>()
        vaultState.localChanges.filter { it.changeType.isTransfer }.forEach {
            when (it.changeType) {
                LocalChangeType.TRANSFER_ETH -> {
                    val transfer = it as EtherTransferChange
                    val delay = "0" // TODO: accept, store, read delay!!!
                    val txHash = interactor.sendEther(transfer.destination, transfer.amount, delay, expectedNonceInt.toString())
                    expectedNonceInt++
                    val pendingTransfer = readPendingChangeFormTxHash(txHash)
                    allChanges.add(pendingTransfer)
                }
                LocalChangeType.TRANSFER_ERC20 -> TODO()
            }
        }

        return allChanges
    }

    /**
     * Commits all local config changes there are. Config changes are batched and scheduled in a single transaction
     * @return [PendingChange]
     * */
    fun commitLocalChanges(expectedNonce: String): PendingChange{
        val batchedOperation = BatchedOperation()
        vaultState.localChanges.filter { it.changeType.isConfig }.forEach {
            when (it.changeType) {
                LocalChangeType.ADD_PARTICIPANT,
                LocalChangeType.REMOVE_PARTICIPANT,
                LocalChangeType.CHOWN,
                LocalChangeType.UNFREEZE -> {
                    vaultState.stageChangeForRemoval(it)
                    batchedOperation.add(it)
                }
                else -> throw RuntimeException("Change Type ${it.changeType} shouldn't reach here. This is a bug.")
            }
        }
        if (batchedOperation.size < 1){
            throw RuntimeException("Zero local changes found.")
        }

        val txHash = interactor.changeConfiguration(batchedOperation.actions, batchedOperation.args, expectedNonce)
        vaultState.removeChangesStagedForRemoval()
        return readPendingChangeFormTxHash(txHash)
    }

    private fun readPendingChangeFormTxHash(txHash: String): PendingChange {
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
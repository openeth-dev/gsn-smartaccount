package com.tabookey.safechannels.vault

import com.tabookey.safechannels.blockchain.BlockchainTransaction
import com.tabookey.safechannels.extensions.hexStringToByteArray
import com.tabookey.safechannels.platforms.VaultContractInteractor
import com.tabookey.safechannels.vault.localchanges.EtherTransferChange
import com.tabookey.safechannels.vault.localchanges.LocalChangeType
import com.tabookey.safechannels.vault.localchanges.LocalVaultChange
import com.tabookey.safechannels.vault.localchanges.ParticipantChange

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
     * Commits all local changes there are. Note that this may require multiple
     * transactions and potentially increments [expectedNonce] more then once
     */
    fun commitLocalChanges(expectedNonce: String): List<PendingChange> {
        val allChanges = mutableListOf<PendingChange>()
        var expectedNonceVar = expectedNonce.toInt()
        val batchedOperation = object {
            val actions = mutableListOf<String>()
            val args = mutableListOf<ByteArray>()
        }
        vaultState.localChanges
                .forEach {
                    when (it.changeType) {
                        LocalChangeType.ADD_PARTICIPANT,
                        LocalChangeType.REMOVE_PARTICIPANT,
                        LocalChangeType.CHOWN -> {
                            batchedOperation.actions.add(it.contractActionValue)
                            batchedOperation.args.add((it as ParticipantChange).participant.hexStringToByteArray())
                        }
                        LocalChangeType.UNFREEZE -> {
                            batchedOperation.actions.add(it.contractActionValue)
                            batchedOperation.args.add(ByteArray(0))
                        }
                        LocalChangeType.TRANSFER_ETH -> {
                            val transfer = it as EtherTransferChange
                            val delay = "0" // TODO: accept, store, read delay!!!
                            val txHash = interactor.sendEther(transfer.destination, transfer.amount, delay, expectedNonce)
                            val pendingTransfer = readPendingChangeFormTxHash(txHash)
                            allChanges.add(pendingTransfer)
                            // TODO: organize this loop better!!!
                            expectedNonceVar++
                        }
                        LocalChangeType.TRANSFER_ERC20 -> TODO()
                        LocalChangeType.INITIALIZE -> {
                            throw RuntimeException("The vault appears to be initialized already")
                        }
                    }
                }

        vaultState.clearChanges()

        val txHash = interactor.changeConfiguration(batchedOperation.actions, batchedOperation.args, expectedNonceVar.toString())
        val batchedChange = readPendingChangeFormTxHash(txHash)
        allChanges.add(batchedChange)
        return allChanges
    }

    private fun readPendingChangeFormTxHash(txHash: String): PendingChange {
        val event = interactor.getConfigPendingEvent(txHash)
        val dueTime = interactor.getPendingChangeDueTime(event.transactionHash)
        val batchedChange = PendingChange(BlockchainTransaction(txHash), event, dueTime)
        return batchedChange
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
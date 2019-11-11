package com.tabookey.safechannels.vault

import com.tabookey.duplicated.*
import com.tabookey.safechannels.addressbook.AddressBook
import com.tabookey.safechannels.blockchain.BlockchainTransaction
import com.tabookey.safechannels.extensions.toHexString
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
// TODO: API to select a participant that can perform an operation (RUN-AS) if >1 is available (speak to Dror)
class DeployedVault(
        private val interactor: VaultContractInteractor,
        private val addressBook: AddressBook,
        storage: VaultStorageInterface,
        vaultState: VaultState) : SharedVaultInterface(storage, vaultState) {

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
            get() {
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
    suspend fun commitLocalChanges(expectedNonce: String): PendingChange {
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
        if (batchedOperation.size < 1) {
            throw RuntimeException("Zero local changes found.")
        }

        val txHash = interactor.changeConfiguration(batchedOperation.actions, batchedOperation.args, expectedNonce)
        vaultState.removeChangesStagedForRemoval()
        return readPendingChangeFormTxHash(txHash)
    }

    // TODO: probably cannot do this because it is not mined yet. Construct a dummy instead and listen to blockchain.
    private fun readPendingChangeFormTxHash(txHash: String): PendingChange {
        val event = interactor.getConfigPendingEvent(txHash)
        val dueTime = interactor.getPendingChangeDueTime(event.configChangeHash)
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

    suspend fun applyPendingChange(pendingChange: PendingChange): BlockchainTransaction {
        if (pendingChange.isDue) {
            throw RuntimeException("The change you are trying to apply is not past the delay period")
        }
        val applyTxHash = interactor.applyPendingConfigurationChange(pendingChange.event)
        return BlockchainTransaction(applyTxHash)

    }

    fun refresh() {
        val eventsResponses = interactor.getPastEvents()
        // TODO: tests, same forother inconsistent logs
        if (
                eventsResponses[0] !is VaultCreatedEventResponse &&
                eventsResponses[1] !is GatekeeperInitializedEventResponse) {
            throw RuntimeException("Invalid beginning of the events list")
        }
        val configPendingChanges: MutableList<PendingChange> = mutableListOf()
        for (i in eventsResponses.indices) {
            when (val it = eventsResponses[i]) {
                is VaultCreatedEventResponse -> {
                    if (i != 0) {
                        throw RuntimeException("Vault Created cannot be emitted more than once")
                    }
                    vaultState.gatekeeperAddress = it.gatekeeper
                }
                is GatekeeperInitializedEventResponse -> {
                    if (i != 1) {
                        throw RuntimeException("Gatekeeper Initialized cannot be emitted more than once")
                    }
                    val recognition =
                            it.participants
                                    .map { it.toHexString() }
                                    .map { addressBook.recognizeParticipant(vaultState.vaultId, it) }

                    vaultState.knownParticipants = recognition.mapNotNull { it.first }
                    vaultState.secretParticipants = recognition.filter { it.first == null }.map { it.second }
                }
                is ConfigPendingEventResponse -> {
                    val change = readPendingChangeFormTxHash(it.transactionHash)
                    configPendingChanges.add(change)
                }
                is ConfigAppliedEventResponse -> {
                }
                is ConfigCancelledEventResponse -> {
                }
                is ParticipantAddedEventResponse -> {
                }
                is ParticipantRemovedEventResponse -> {
                }
            }
        }
    }
}
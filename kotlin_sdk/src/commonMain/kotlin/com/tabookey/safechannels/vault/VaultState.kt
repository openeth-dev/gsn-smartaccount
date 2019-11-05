package com.tabookey.safechannels.vault

import com.tabookey.duplicated.VaultParticipant
import com.tabookey.safechannels.vault.localchanges.LocalVaultChange


/**
 * Includes all data known about the vault (not organized in any way now, needs structure)
 */
class VaultState(val vaultId: Int) {

    val delays: List<Int> = emptyList()
    val isDeployed: Boolean = false

    lateinit var activeParticipant: VaultParticipant // TODO: convert to list

    // We do not store participants on chain.
    // Therefore, there can be 3 kinds of participants - known, bogus and unknown
    var knownParticipants: Array<VaultParticipant> = emptyArray()
    var secretParticipants: Array<String> = emptyArray()

    var address: String? = null
    var gatekeeperAddress: String? = null

    private val _localChanges = ArrayList<LocalVaultChange>()
    private val _pendingChanges = ArrayList<PendingChange>()

    // https://discuss.kotlinlang.org/t/exposing-a-mutable-member-as-immutable/6359
    val localChanges: List<LocalVaultChange>
        get() = _localChanges

    private val stagedForRemovalChanges: MutableList<LocalVaultChange> = mutableListOf()

    /**
     * While batching and broadcasting the operation, the local change cannot be removed until the transaction
     * is broadcast and its hash is saved. It must be flagged for removal in between.
     */
    // TODO: Make it a local variable. Has nothing to do with Storage
    @Deprecated("")
    fun stageChangeForRemoval(change: LocalVaultChange) {
        stagedForRemovalChanges.add(change)
    }

    fun addLocalChange(change: LocalVaultChange) {
        _localChanges.add(change)
    }

    fun removeChange(change: LocalVaultChange) {
        _localChanges.remove(change)
    }

    //TODO
    fun removeChangesStagedForRemoval() {
        _localChanges.clear()
    }
}

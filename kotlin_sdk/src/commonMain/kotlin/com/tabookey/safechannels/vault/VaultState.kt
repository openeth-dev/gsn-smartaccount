package com.tabookey.safechannels.vault

import com.tabookey.safechannels.addressbook.VaultParticipantTuple

/**
 * Includes all data known about the vault (not organized in any way now, needs structure)
 */
class VaultState {

    val delays: List<Int> = emptyList()
    val isDeployed: Boolean = false

    // Legitimate reason for null - never saved to any DB (should not happen, actually)
    var id: Int? = null

    lateinit var activeParticipant: VaultParticipantTuple
    val address: String? = null

    private val _localChanges = ArrayList<LocalVaultChange>()
    private val _pendingChanges = ArrayList<PendingChange>()

    // https://discuss.kotlinlang.org/t/exposing-a-mutable-member-as-immutable/6359
    val localChanges: List<LocalVaultChange>
        get() = _localChanges

    fun addLocalChange(change: LocalVaultChange) {
        _localChanges.add(change)
    }
}

package com.tabookey.safechannels.vault

/**
 * Includes all data known about
 */
class VaultState {

    private var id: Int? = null;
    private val localChanges = ArrayList<LocalVaultChange>()
    private val pendingChanges = ArrayList<PendingChange>()

    fun getLocalChanges(): List<LocalVaultChange> {
        return localChanges
    }

    fun addLocalChange(change: LocalVaultChange) {
        localChanges.add(change)
    }
}

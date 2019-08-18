package com.tabookey.safechannels.vault

open class VaultInstance(
        internal val vaultState: VaultState) {

    fun getVaultState(): VaultState {
        return vaultState
    }

    fun discardAllChanges() {

    }

    fun discardLocalChange(change: LocalVaultChange) {

    }

}
package com.tabookey.safechannels.vault.localchanges

enum class LocalChangeType {
    ADD_PARTICIPANT,
    REMOVE_PARTICIPANT,
    CHOWN,
    UNFREEZE,
    TRANSFER_ETH,
    TRANSFER_ERC20,
    INITIALIZE;

    val isConfig: Boolean
    get() {
        return this in arrayOf(ADD_PARTICIPANT, REMOVE_PARTICIPANT, CHOWN, UNFREEZE)
    }

    val isTransfer: Boolean
    get() {
        return this in arrayOf(TRANSFER_ETH, TRANSFER_ERC20)
    }
}
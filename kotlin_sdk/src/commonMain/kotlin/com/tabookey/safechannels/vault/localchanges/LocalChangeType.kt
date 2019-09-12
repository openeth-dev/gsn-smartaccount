package com.tabookey.safechannels.vault.localchanges

enum class LocalChangeType {
    ADD_PARTICIPANT,
    REMOVE_PARTICIPANT,
    CHOWN,
    UNFREEZE,
    TRANSFER_ETH,
    TRANSFER_ERC20,
    INITIALIZE;
}
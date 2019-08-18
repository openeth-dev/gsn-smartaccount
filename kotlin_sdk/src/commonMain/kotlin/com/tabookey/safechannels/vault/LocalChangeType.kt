package com.tabookey.safechannels.vault

enum class LocalChangeType {
    ADD_PARTICIPANT,
    REMOVE_PARTICIPANT,
    CHOWN,
    UNFREEZE,
    /**
     * The only 'extra' change type (not present in contract), it doesn't need a delay but can be in a local state
     */
    INITIALIZE
}
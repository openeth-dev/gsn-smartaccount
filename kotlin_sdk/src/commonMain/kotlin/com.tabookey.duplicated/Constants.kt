package com.tabookey.duplicated

enum class ChangeType(val stringValue: String) {
    ADD_PARTICIPANT("0"), // arg: participant_hash
    REMOVE_PARTICIPANT("1"), // arg: participant_hash
    CHOWN("2"), // arg: address
    UNFREEZE("3")            // no args
}
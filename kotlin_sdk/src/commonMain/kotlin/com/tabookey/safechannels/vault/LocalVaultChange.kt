package com.tabookey.safechannels.vault

import com.tabookey.safechannels.addressbook.AddressBookEntry

class LocalVaultChange(val changeType: LocalChangeType) {

    lateinit var permissions: VaultPermissions
        private set

    lateinit var participant: AddressBookEntry
        private set

    companion object {
        fun addParticipant(participant: AddressBookEntry, permissions: VaultPermissions): LocalVaultChange {
            val change = LocalVaultChange(LocalChangeType.ADD_PARTICIPANT)
            change.participant = participant
            change.permissions = permissions
            return change
        }
    }


}
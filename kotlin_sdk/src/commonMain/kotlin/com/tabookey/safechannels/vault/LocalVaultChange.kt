package com.tabookey.safechannels.vault

import com.tabookey.duplicated.VaultPermissions
import com.tabookey.safechannels.addressbook.EthereumAddress

class LocalVaultChange private constructor(val changeType: LocalChangeType) {

    lateinit var permissions: VaultPermissions
        private set

    lateinit var participant: EthereumAddress
        private set

    companion object {
        fun initialize(): LocalVaultChange {
            return LocalVaultChange(LocalChangeType.INITIALIZE)
        }

        fun addParticipant(participant: EthereumAddress, permissions: VaultPermissions): LocalVaultChange {
            val change = LocalVaultChange(LocalChangeType.ADD_PARTICIPANT)
            change.participant = participant
            change.permissions = permissions
            return change
        }

        fun changeOwner(participant: EthereumAddress): LocalVaultChange {
            val change = LocalVaultChange(LocalChangeType.CHOWN)
            change.participant = participant
            change.permissions = VaultPermissions.OWNER_PERMISSIONS
            return change
        }
    }


}
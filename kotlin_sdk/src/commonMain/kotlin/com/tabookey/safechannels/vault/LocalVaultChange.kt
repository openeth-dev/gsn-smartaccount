package com.tabookey.safechannels.vault

import com.tabookey.duplicated.VaultPermissions
import com.tabookey.safechannels.addressbook.EthereumAddress

class LocalVaultChange private constructor(val changeType: LocalChangeType) {

    fun getStringArgs(): String {
        return if (participant != null){
            participant as EthereumAddress
        }
        else ""
    }

    lateinit var permissions: VaultPermissions
        private set

    var participant: EthereumAddress? = null
        private set

    companion object {
        fun initialize(newOwner: EthereumAddress): LocalVaultChange {
            val change = LocalVaultChange(LocalChangeType.INITIALIZE)
            change.participant = newOwner
            change.permissions = VaultPermissions.OWNER_PERMISSIONS
            return change
        }

        fun addParticipant(participant: EthereumAddress, permissions: VaultPermissions): LocalVaultChange {
            val change = LocalVaultChange(LocalChangeType.ADD_PARTICIPANT)
            change.participant = participant
            change.permissions = permissions
            return change
        }

        fun changeOwner(newOwner: EthereumAddress): LocalVaultChange {
            val change = LocalVaultChange(LocalChangeType.CHOWN)
            change.participant = newOwner
            change.permissions = VaultPermissions.OWNER_PERMISSIONS
            return change
        }
    }


}
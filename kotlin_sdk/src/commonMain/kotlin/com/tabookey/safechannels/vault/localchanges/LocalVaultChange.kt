package com.tabookey.safechannels.vault.localchanges

import com.tabookey.duplicated.ChangeType
import com.tabookey.duplicated.VaultPermissions
import com.tabookey.safechannels.addressbook.EthereumAddress

open class LocalVaultChange internal constructor(val changeType: LocalChangeType) {

    val contractActionValue: String
        get() {
            return when(changeType){
                LocalChangeType.ADD_PARTICIPANT -> ChangeType.ADD_PARTICIPANT.stringValue
                LocalChangeType.REMOVE_PARTICIPANT ->  ChangeType.ADD_PARTICIPANT.stringValue
                LocalChangeType.CHOWN ->  ChangeType.ADD_PARTICIPANT.stringValue
                LocalChangeType.UNFREEZE ->  ChangeType.ADD_PARTICIPANT.stringValue
                else -> throw RuntimeException("This local change does not have a corresponding on-chain constant")
            }
        }

    companion object {
        fun initialize(newOwner: EthereumAddress): InitializeVaultChange {
            return InitializeVaultChange(newOwner)
        }

        fun addParticipant(participant: EthereumAddress, permissions: VaultPermissions): AddParticipantChange {
            return AddParticipantChange(participant, permissions)
        }

        fun changeOwner(newOwner: EthereumAddress): ChangeOwnerParticipantChange {
            return ChangeOwnerParticipantChange(newOwner)
        }

        fun transferEther(amount: String, destination: String): EtherTransferChange {
            return EtherTransferChange(amount, destination)
        }
    }


}
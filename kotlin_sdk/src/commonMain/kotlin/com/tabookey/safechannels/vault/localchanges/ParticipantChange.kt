package com.tabookey.safechannels.vault.localchanges

import com.tabookey.duplicated.VaultPermissions
import com.tabookey.safechannels.addressbook.EthereumAddress
import com.tabookey.safechannels.extensions.hexStringToByteArray

abstract class ParticipantChange internal constructor(
        changeType: LocalChangeType,
        private val _participant: EthereumAddress,
        private val _permissions: VaultPermissions) : LocalVaultChange(changeType) {

    val participant: EthereumAddress
        get() {
            return _participant
        }

    val permissions: VaultPermissions
        get() {
            return _permissions
        }

    override val arg: ByteArray
        get() {
            return participant.hexStringToByteArray()
        }
}

class AddParticipantChange(participant: String, permissions: VaultPermissions)
    : ParticipantChange(LocalChangeType.ADD_PARTICIPANT, participant, permissions)

class RemoveParticipantChange(participant: String, permissions: VaultPermissions)
    : ParticipantChange(LocalChangeType.REMOVE_PARTICIPANT, participant, permissions)

class ChangeOwnerParticipantChange(participant: String)
    : ParticipantChange(LocalChangeType.CHOWN, participant, VaultPermissions.OWNER_PERMISSIONS)

class InitializeVaultChange(participant: String) // TODO: this should be moved from here once there is a difference
    : ParticipantChange(LocalChangeType.INITIALIZE, participant, VaultPermissions.OWNER_PERMISSIONS)
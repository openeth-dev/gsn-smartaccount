package com.tabookey.duplicated

/**
 *
 */
class VaultParticipant(
        val permissions: VaultPermissions,
        val level: Int,
        val address: EthereumAddress) {

    val participantHash: String = address + "_hashME" + permissionLevel // TODO: I had this hash method somewhere

    val permissionLevel: String
        get() {
            return VaultPermissions.packPermissionLevel(permissions, level)
        }
}

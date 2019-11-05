package com.tabookey.duplicated

/**
 *
 */
class VaultParticipant(
        val permissions: VaultPermissions,
        val level: Int,
        val address: EthereumAddress) {

    fun packPermissionLevel(): String {
        return VaultPermissions.packPermissionLevel(permissions, level)
    }
}

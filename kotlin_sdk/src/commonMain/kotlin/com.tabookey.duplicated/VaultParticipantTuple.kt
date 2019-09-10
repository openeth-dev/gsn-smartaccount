package com.tabookey.duplicated

/**
 *
 */
class VaultParticipantTuple(
        val permissions: VaultPermissions,
        val level: Int,
        val address: EthereumAddress) {

//    fun packPermissionLevel(): String {
//        val permInt = permissions.getValue()
//        val levelInt = level
//
//        assert(permInt  <= 0x07FF)
//        assert(levelInt <= 0x1F)
//        return /*"0x" + */((levelInt shl 11) + permInt).toString(16)
//    }

    fun packPermissionLevel(): String {
        return VaultPermissions.packPermissionLevel(permissions, level)
    }
}

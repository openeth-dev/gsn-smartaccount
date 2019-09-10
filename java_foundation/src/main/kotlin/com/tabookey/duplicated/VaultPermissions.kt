package com.tabookey.duplicated

class VaultPermissions(private val integerRepresentation: Int) {

    constructor(vararg permission: Permission) : this(permission.fold(0) { p1, p2 ->
        p1 or p2.value
    })

    enum class Permission(val value: Int) {
        canSpend(1 shl 0),
        canUnfreeze(1 shl 1),
        canChangeParticipants(1 shl 2),
        canChangeOwner(1 shl 3),
        canSignBoosts(1 shl 4),
        canExecuteBoosts(1 shl 5),
        canFreeze(1 shl 6),
        canCancelConfigChanges(1 shl 7),
        canCancelSpend(1 shl 8),
        canChangeConfig(canUnfreeze.value or canChangeParticipants.value or canChangeOwner.value),
        canCancel(Permission.canCancelSpend.value or Permission.canCancelConfigChanges.value)
    }


    companion object {

        val OWNER_PERMISSIONS = VaultPermissions(Permission.canSpend, Permission.canCancel, Permission.canFreeze, Permission.canChangeConfig, Permission.canSignBoosts)
        val ADMIN_PERMISSIONS = VaultPermissions(Permission.canChangeOwner, Permission.canExecuteBoosts)
        val WATCHDOG_PERMISSIONS = VaultPermissions(Permission.canCancel, Permission.canFreeze)

        fun packPermissionLevel(permissions: VaultPermissions, level: Int): String {
            val permInt = permissions.getValue()
            assert(permInt <= 0x07FF)
            assert(level <= 0x1F)
            return /*"0x" + */((level shl 11) + permInt).toString(16)
        }
    }

    fun addPermission(permission: Permission): VaultPermissions {
        return VaultPermissions(integerRepresentation or permission.value)
    }

    fun getValue(): Int {
        return integerRepresentation
    }


}
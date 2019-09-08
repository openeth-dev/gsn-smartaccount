package com.tabookey.duplicated

class VaultPermissions(private var integerRepresentation: Int) {

    enum class Permission(val value: Int) {
        canSpend(1 shl 0)
    }

    companion object {
        val ADMIN_PERMISSIONS = VaultPermissions(777)
        val OWNER_PERMISSIONS = VaultPermissions(777)
        val WATCHDOG_PERMISSIONS = VaultPermissions(777)
    }

    fun addPermission(permission: Permission){
        integerRepresentation = integerRepresentation and permission.value
    }

    fun getValue(): Int {
        return integerRepresentation
    }
}
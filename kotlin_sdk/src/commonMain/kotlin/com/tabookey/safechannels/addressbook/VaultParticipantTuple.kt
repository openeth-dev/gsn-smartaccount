package com.tabookey.safechannels.addressbook

import com.tabookey.safechannels.vault.VaultPermissions

/**
 *
 */
class VaultParticipantTuple(
        val permissions: VaultPermissions,
        val level: Int,
        val address: EthereumAddress)
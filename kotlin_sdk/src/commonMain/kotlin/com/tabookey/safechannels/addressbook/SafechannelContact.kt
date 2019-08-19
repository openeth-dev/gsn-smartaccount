package com.tabookey.safechannels.addressbook

class SafechannelContact(
        val guid: String,
        val nameAlias: String
) {
    val participantTuples: MutableMap<Int, VaultParticipantTuple> = HashMap()

    fun addParticipantTuple(vaultId: Int, tuple: VaultParticipantTuple) {
        participantTuples[vaultId] = tuple
    }
}

package com.tabookey.safechannels.addressbook

import com.tabookey.duplicated.VaultParticipantTuple

class SafechannelContact(
        val guid: String,
        val nameAlias: String
) {
    val participantTuples: MutableMap<Int, MutableList<VaultParticipantTuple>> = HashMap()

    fun addParticipantTuple(vaultId: Int, tuple: VaultParticipantTuple) {
        if (participantTuples[vaultId] == null){
            participantTuples[vaultId] = ArrayList()
        }
        participantTuples[vaultId]!!.add(tuple)
    }
}

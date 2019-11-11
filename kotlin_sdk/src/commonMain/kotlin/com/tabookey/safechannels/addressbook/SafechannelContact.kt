package com.tabookey.safechannels.addressbook

import com.tabookey.duplicated.VaultParticipant

class SafechannelContact(
        val guid: String,
        val nameAlias: String
) {
    val participantTuples: MutableMap<Int, MutableList<VaultParticipant>> = HashMap()

    fun addParticipantTuple(vaultId: Int, tuple: VaultParticipant) {
        if (participantTuples[vaultId] == null){
            participantTuples[vaultId] = ArrayList()
        }
        // TODO: prevent from adding a duplicate
        participantTuples[vaultId]!!.add(tuple)
    }
}

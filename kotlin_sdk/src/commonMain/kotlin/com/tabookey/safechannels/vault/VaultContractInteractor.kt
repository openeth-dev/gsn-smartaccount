package com.tabookey.safechannels

import com.tabookey.safechannels.addressbook.VaultParticipantTuple

expect class VaultContractInteractor {

    // not a real constructor, just a stub of what I think is needed. Cannot really construct 'Credentials' I think, this would mean we have private keys.
    /**
     * @param activeParticipant - this is the address that represents 'me', which does not have to be an owner. Looking for a better name.
     */
    constructor(address: String, activeParticipant: VaultParticipantTuple/*bla bla*/)

    fun getGatekeeperAddress(): String
    suspend fun getOperatorSync(): String
}
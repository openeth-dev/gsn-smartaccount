package com.tabookey.safechannels

import com.tabookey.foundation.Asdas
import com.tabookey.safechannels.addressbook.VaultParticipantTuple

actual class VaultContractInteractor {

    actual fun getGatekeeperAddress(): String {
        val a = Asdas()
        TODO("not implemented") //To change body of created functions use File | Settings | File Templates.
    }

    actual suspend fun getOperatorSync(): String {
        TODO("not implemented") //To change body of created functions use File | Settings | File Templates.
    }

    /**
     * @param activeParticipant - this is the address that represents 'me', which does not have to be an owner. Looking for a better name.
     */
    actual constructor(address: String, activeParticipant: VaultParticipantTuple) {
        TODO("not implemented") //To change body of created functions use File | Settings | File Templates.
    }
}
package com.tabookey.safechannels.platforms

import com.tabookey.duplicated.ConfigPendingEventResponse

expect class VaultContractInteractor {

    fun changeConfiguration(actions: List<String>,
                            args: List<String>,
                            expectedNonce: String): String

    fun getConfigPendingEvent(txHash: String): ConfigPendingEventResponse

    fun getPendingChangeDueTime(configChangeHash: ByteArray): String

}
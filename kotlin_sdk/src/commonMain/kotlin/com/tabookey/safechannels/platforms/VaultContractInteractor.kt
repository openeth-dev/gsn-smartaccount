package com.tabookey.safechannels.platforms

import com.tabookey.duplicated.ConfigPendingEventResponse

expect class VaultContractInteractor {

    suspend fun changeConfiguration(actions: List<String>,
                            args: List<ByteArray>,
                            expectedNonce: String): String

    fun sendEther(destination: String, value: String, delay: String, expectedNonce: String): String

    fun getConfigPendingEvent(txHash: String): ConfigPendingEventResponse

    fun getPendingChangeDueTime(configChangeHash: ByteArray): String

}
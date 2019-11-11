package com.tabookey.safechannels.platforms

import com.tabookey.duplicated.ConfigPendingEventResponse
import com.tabookey.duplicated.EventResponse

expect class VaultContractInteractor {

    suspend fun changeConfiguration(
            actions: List<String>,
            args: List<ByteArray>,
            expectedNonce: String): String

    suspend fun applyPendingConfigurationChange(event: ConfigPendingEventResponse): String

    fun sendEther(destination: String, value: String, delay: String, expectedNonce: String): String

    fun getConfigPendingEvent(txHash: String): ConfigPendingEventResponse

    fun getPendingChangeDueTime(configChangeHash: ByteArray): String

    fun getPastEvents(): List<EventResponse>

}
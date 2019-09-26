package com.tabookey.safechannels.platforms

import com.tabookey.duplicated.ConfigPendingEventResponse
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException
import kotlin.coroutines.suspendCoroutine
import kotlin.js.Promise

suspend fun <T> Promise<T>.await(): T = suspendCoroutine { cont ->
    then({ cont.resume(it) }, { cont.resumeWithException(it) })
}

actual class VaultContractInteractor internal constructor(private val nativeInteractor: VaultContractInteractorWithPromises) {

    actual suspend fun changeConfiguration(actions: List<String>, args: List<ByteArray>, expectedNonce: String): String {
        val changeConfiguration = nativeInteractor.changeConfiguration(emptyList(), emptyList(), "")
        return changeConfiguration.await()
    }

    actual fun sendEther(destination: String, value: String, delay: String, expectedNonce: String): String {
        TODO("not implemented") //To change body of created functions use File | Settings | File Templates.
    }

    actual fun getConfigPendingEvent(txHash: String): ConfigPendingEventResponse {
        TODO("not implemented") //To change body of created functions use File | Settings | File Templates.
    }

    actual fun getPendingChangeDueTime(configChangeHash: ByteArray): String {
        TODO("not implemented") //To change body of created functions use File | Settings | File Templates.
    }

    actual suspend fun applyPendingConfigurationChange(event: ConfigPendingEventResponse): String {
        TODO("not implemented") //To change body of created functions use File | Settings | File Templates.
    }
}
package com.tabookey.safechannels.platforms

import com.tabookey.safechannels.VaultContractInteractorWithPromises
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException
import kotlin.coroutines.suspendCoroutine
import kotlin.js.Promise

suspend fun <T> Promise<T>.await(): T = suspendCoroutine { cont ->
    then({ cont.resume(it) }, { cont.resumeWithException(it) })
}

actual class VaultContractInteractor(private val nativeInteractor: VaultContractInteractorWithPromises) {

    actual fun getGatekeeperAddress(): String {
        return nativeInteractor.getGatekeeperAddress()
    }

    actual suspend fun getOperatorSync(): String {
        println("hi=")
        val promise = nativeInteractor.getOperator()
        println("promise=$promise")
        val s = suspendCoroutine<String> { cont ->
            promise.then(
                    {
                        println("promise.then$it")
                        cont.resume(it)
                    },
                    {
                        println("promise.then-reject$it")
                    })
        }
        return s;
    }

}
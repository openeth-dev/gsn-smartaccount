package com.tabookey.safechannels.platforms

import kotlin.js.Promise

@JsName(name = "VaultContractInteractor")
external class VaultContractInteractorWithPromises {

    fun changeConfiguration(actions: List<String>, args: List<ByteArray>, expectedNonce: String): Promise<String>

    fun getGatekeeperAddress(): String

    fun getOperatorSync(): String

    fun getOperator(): Promise<String>

}

fun wrap(a: VaultContractInteractorWithPromises): VaultContractInteractor {
    return VaultContractInteractor(a)
}
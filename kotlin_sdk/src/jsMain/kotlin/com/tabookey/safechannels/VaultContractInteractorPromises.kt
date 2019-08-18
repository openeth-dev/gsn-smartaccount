package com.tabookey.safechannels

import kotlin.js.Promise

@JsName(name = "VaultContractInteractor")
external class VaultContractInteractorWithPromises {

    companion object {

        fun connect(): Promise<VaultContractInteractor>
    }

    fun getGatekeeperAddress(): String

    fun getOperatorSync(): String

    fun getOperator(): Promise<String>

}

fun wrap(a: VaultContractInteractorWithPromises): VaultContractInteractor {
    return com.tabookey.safechannels.VaultContractInteractor(a)
}
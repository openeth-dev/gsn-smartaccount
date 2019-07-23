package com.tabookey.kotlin_sdk

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

fun wrap(a: VaultContractInteractorWithPromises): VaultContractInteractor{
    return VaultContractInteractor(a)
}
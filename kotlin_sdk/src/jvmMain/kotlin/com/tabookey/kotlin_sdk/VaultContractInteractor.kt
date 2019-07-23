package com.tabookey.kotlin_sdk

import kotlinx.coroutines.GlobalScope
import kotlinx.coroutines.async


actual class VaultContractInteractor {

    actual fun getGatekeeperAddress(): String {
        println("jgf" + GlobalScope.async { });
        TODO("not implemented") //To change body of created functions use File | Settings | File Templates.
    }

    actual suspend fun getOperatorSync(): String {
        TODO("not implemented") //To change body of created functions use File | Settings | File Templates.
    }
}
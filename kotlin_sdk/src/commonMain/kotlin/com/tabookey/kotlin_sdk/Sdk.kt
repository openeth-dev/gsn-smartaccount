package com.tabookey.kotlin_sdk

import kotlinx.coroutines.GlobalScope
import kotlinx.coroutines.async
import kotlin.js.JsName

class Sdk(val interactor: VaultContractInteractor) {
    @JsName("getOperatorBlaBla")
    fun getOperatorBlaBla(block: (String) -> Unit) {
        GlobalScope.async {
            val operatorSync = interactor.getOperatorSync()
            block(operatorSync)
        }
    }
}
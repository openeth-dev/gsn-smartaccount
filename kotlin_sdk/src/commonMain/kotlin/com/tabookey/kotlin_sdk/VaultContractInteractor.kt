package com.tabookey.kotlin_sdk

expect class VaultContractInteractor {

    fun getGatekeeperAddress(): String
    suspend fun getOperatorSync(): String
}
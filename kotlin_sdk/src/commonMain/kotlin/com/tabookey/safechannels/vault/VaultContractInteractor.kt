package com.tabookey.safechannels

expect class VaultContractInteractor {

    fun getGatekeeperAddress(): String
    suspend fun getOperatorSync(): String
}
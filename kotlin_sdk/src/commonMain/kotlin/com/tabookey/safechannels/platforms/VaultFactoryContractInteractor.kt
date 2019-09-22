package com.tabookey.safechannels.platforms

expect class VaultFactoryContractInteractor{

    companion object{
        suspend fun connect(): VaultFactoryContractInteractor
    }

    suspend fun deployNewGatekeeper(): Response
}
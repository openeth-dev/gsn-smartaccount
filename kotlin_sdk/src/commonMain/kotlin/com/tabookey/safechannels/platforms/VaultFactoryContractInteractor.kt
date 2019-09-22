package com.tabookey.safechannels.platforms

expect class VaultFactoryContractInteractor{


    suspend fun deployNewGatekeeper(): Response
}
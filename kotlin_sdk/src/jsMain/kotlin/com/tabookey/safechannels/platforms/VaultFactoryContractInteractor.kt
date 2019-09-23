package com.tabookey.safechannels.platforms

actual external class VaultFactoryContractInteractor {
    actual suspend fun deployNewGatekeeper(): Response

    actual companion object {
        actual suspend fun connect(): VaultFactoryContractInteractor
    }
}
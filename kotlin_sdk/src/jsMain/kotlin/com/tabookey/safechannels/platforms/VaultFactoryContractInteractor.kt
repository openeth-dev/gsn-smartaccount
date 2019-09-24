package com.tabookey.safechannels.platforms

actual class VaultFactoryContractInteractor internal constructor(private val nativeInteractor: VaultFactoryContractInteractorPromises) {

    actual suspend fun deployNewGatekeeper(): Response {
        return nativeInteractor.deployNewGatekeeper().await()
    }

}
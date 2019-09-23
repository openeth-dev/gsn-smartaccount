package com.tabookey.safechannels.platforms

import com.tabookey.duplicated.EthereumAddress
import com.tabookey.duplicated.IKredentials

actual class VaultFactoryContractInteractor(private val nativeInteractor: VaultFactoryContractInteractorPromises) {

    actual suspend fun deployNewGatekeeper(): Response {
        return nativeInteractor.deployNewGatekeeper().await()
    }

    actual companion object {
        actual suspend fun connect(credentials: IKredentials, vaultFactoryAddress: String, ethNodeUrl: String, networkId: Int): VaultFactoryContractInteractor{
            js("var VaultFactoryContractInteractor = require(\"js_foundation/src/js/VaultFactoryContractInteractor\");")
            val nativeInteractor = VaultFactoryContractInteractorPromises.connect(credentials, vaultFactoryAddress, ethNodeUrl, networkId).await()
            return VaultFactoryContractInteractor(nativeInteractor)
        }

        actual suspend fun deployNewVaultFactory(from: EthereumAddress, ethNodeUrl: String): String{
            // TODO:
            // Ok, I cannot really explain this except if it is a bug in a transpiler.
            // I did annotate the VaultFactoryContractInteractorPromises with @JsName("VaultFactoryContractInteractor")
            // and yet the generated test code does not include, require or reference it. WHO IS SUPPOSED TO DO IT, THEN? It's a test!!
            js("var VaultFactoryContractInteractor = require(\"js_foundation/src/js/VaultFactoryContractInteractor\");")
            return VaultFactoryContractInteractorPromises.deployNewVaultFactory(from, ethNodeUrl).await()
        }
    }
}
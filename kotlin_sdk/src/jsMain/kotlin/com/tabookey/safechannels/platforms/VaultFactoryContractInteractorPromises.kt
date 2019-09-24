package com.tabookey.safechannels.platforms

import com.tabookey.duplicated.EthereumAddress
import com.tabookey.duplicated.IKredentials
import kotlin.js.Promise

external class VaultFactoryContractInteractorPromises {
    suspend fun deployNewGatekeeper(): Promise<Response>

    companion object {
        suspend fun connect(credentials: IKredentials, vaultFactoryAddress: String, ethNodeUrl: String, networkId: Int): Promise<VaultFactoryContractInteractorPromises>
        suspend fun deployNewVaultFactory(from: EthereumAddress, ethNodeUrl: String): Promise<String>
    }
}
package com.tabookey.safechannels.platforms

import com.tabookey.duplicated.EthereumAddress
import com.tabookey.duplicated.IKredentials

expect class VaultFactoryContractInteractor{

    companion object{
        suspend fun connect(credentials: IKredentials, vaultFactoryAddress: String, ethNodeUrl: String, networkId: Int): VaultFactoryContractInteractor
        suspend fun deployNewVaultFactory(from: EthereumAddress, ethNodeUrl: String): String
    }

    suspend fun deployNewGatekeeper(): Response
}
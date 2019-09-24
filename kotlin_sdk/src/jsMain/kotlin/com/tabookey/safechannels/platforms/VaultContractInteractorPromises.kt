package com.tabookey.safechannels.platforms

import com.tabookey.duplicated.EthereumAddress
import com.tabookey.duplicated.IKredentials
import kotlin.js.Promise

external class VaultContractInteractorWithPromises {

    companion object {
        fun connect(credentials: IKredentials, permissions: String, level: String, ethNodeUrl: String, gatekeeperAddress: EthereumAddress, vaultAddress: EthereumAddress): VaultContractInteractorWithPromises
    }

    fun changeConfiguration(actions: List<String>, args: List<ByteArray>, expectedNonce: String): Promise<String>

    fun getGatekeeperAddress(): String

    fun getOperatorSync(): String

    fun getOperator(): Promise<String>

}
package com.tabookey.safechannels.platforms

import com.tabookey.duplicated.EthereumAddress
import com.tabookey.duplicated.VaultParticipant
import com.tabookey.duplicated.IKredentials


expect class InteractorsFactory {

    fun interactorForVaultFactory(
            kredentials: IKredentials
    ): VaultFactoryContractInteractor

    fun interactorForVault(
            kredentials: IKredentials,
            vaultAddress: String,
            gkAddress: String,
            participant: VaultParticipant
    ): VaultContractInteractor

    suspend fun deployNewVaultFactory(from: EthereumAddress): String
}
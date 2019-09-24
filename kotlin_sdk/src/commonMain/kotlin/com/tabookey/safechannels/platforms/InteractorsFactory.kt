package com.tabookey.safechannels.platforms

import com.tabookey.duplicated.EthereumAddress
import com.tabookey.duplicated.VaultParticipantTuple
import com.tabookey.duplicated.IKredentials


expect class InteractorsFactory {

    fun interactorForVaultFactory(
            kredentials: IKredentials,
            vaultFactoryAddress: String
    ): VaultFactoryContractInteractor

    fun interactorForVault(
            kredentials: IKredentials,
            vaultAddress: String,
            gkAddress: String,
            participant: VaultParticipantTuple
    ): VaultContractInteractor

    suspend fun deployNewVaultFactory(from: EthereumAddress): String
}
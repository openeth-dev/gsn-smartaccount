package com.tabookey.safechannels.platforms

import com.tabookey.duplicated.IKredentials
import com.tabookey.duplicated.VaultParticipantTuple


actual class InteractorsFactory {
    actual fun interactorForVaultFactory(kredentials: IKredentials, vaultFactoryAddress: String): VaultFactoryContractInteractor {
        TODO("not implemented") //To change body of created functions use File | Settings | File Templates.
    }

    actual fun interactorForVault(kredentials: IKredentials, vaultAddress: String, gkAddress: String, participant: VaultParticipantTuple): VaultContractInteractor {
        TODO("not implemented") //To change body of created functions use File | Settings | File Templates.
    }

}
package com.tabookey.foundation

import com.tabookey.duplicated.EthereumAddress
import com.tabookey.duplicated.IKredentials
import com.tabookey.duplicated.VaultParticipantTuple
import org.web3j.protocol.Web3j

open class InteractorsFactory(
        private val web3j: Web3j) {

    open fun interactorForVaultFactory(
            kredentials: IKredentials,
            vaultFactoryAddress: String
    ): VaultFactoryContractInteractor {

        if (kredentials is Kredentials) {
            val credentials = kredentials.getCredentials()
            return VaultFactoryContractInteractor(vaultFactoryAddress, web3j, credentials)
        }
        throw RuntimeException("Alex, what the fuck are you doing!?")
    }

    open fun interactorForVault(
            kredentials: IKredentials,
            vaultAddress: String,
            gkAddress: String,
            participant: VaultParticipantTuple): VaultContractInteractor {
        if (kredentials is Kredentials) {
            val credentials = kredentials.getCredentials()
            return VaultContractInteractor(vaultAddress, gkAddress, web3j, credentials, participant)
        }
        throw RuntimeException("Alex, what the fuck are you doing!?")
    }

    // We may not eventually need it in the JVM Foundation, in fact.
    suspend fun deployNewVaultFactory(from: EthereumAddress): String{
        TODO()
    }
}
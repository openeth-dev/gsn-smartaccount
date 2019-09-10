package com.tabookey.foundation

import com.tabookey.foundation.generated.VaultFactory
import org.web3j.crypto.Credentials
import org.web3j.protocol.Web3j
import org.web3j.tx.gas.DefaultGasProvider
import org.web3j.tx.gas.EstimatedGasProvider

open class VaultFactoryContractInteractor(
        private val vaultFactoryAddress: String,
        private val web3j: Web3j,
        private val credentials: Credentials) {


    private var provider: EstimatedGasProvider = EstimatedGasProvider(web3j, DefaultGasProvider.GAS_PRICE, DefaultGasProvider.GAS_LIMIT)
    private var vaultFactory: VaultFactory = VaultFactory.load(vaultFactoryAddress, web3j, credentials, provider)

    open fun deployNewGatekeeper(): Response {
        val receipt = vaultFactory.newVault().send()
        val vaultCreatedEvents = vaultFactory.getVaultCreatedEvents(receipt)
        assert(vaultCreatedEvents.size == 1)
        val event = vaultCreatedEvents[0]
        val res = Response()
        res.gatekeeper = event.gatekeeper
        res.vault = event.vault
        res.sender = event.sender
        return res
    }
}
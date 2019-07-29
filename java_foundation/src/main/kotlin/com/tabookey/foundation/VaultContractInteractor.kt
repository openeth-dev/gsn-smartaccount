package com.tabookey.foundation

import com.tabookey.foundation.generated.Gatekeeper
import com.tabookey.foundation.generated.Vault
import com.tabookey.foundation.generated.VaultFactory
import org.web3j.abi.datatypes.Address
import org.web3j.crypto.Credentials
import org.web3j.protocol.Web3j
import org.web3j.tx.gas.DefaultGasProvider
import org.web3j.tx.gas.EstimatedGasProvider
import org.web3j.utils.Numeric
import java.math.BigInteger

class VaultContractInteractor(
        private var vaultFactory: VaultFactory,
        private var vault: Vault?,
        private var gatekeeper: Gatekeeper?,
        private val web3j: Web3j,
        private val credentials: Credentials) {

    private var provider: EstimatedGasProvider = EstimatedGasProvider(web3j, DefaultGasProvider.GAS_PRICE, DefaultGasProvider.GAS_LIMIT)

    companion object {
        fun connect(vaultFactory: VaultFactory, vault: Vault? = null, gatekeeper: Gatekeeper? = null, web3j: Web3j, credentials: Credentials): VaultContractInteractor {
            return VaultContractInteractor(vaultFactory, vault, gatekeeper, web3j, credentials)
        }
    }

    fun deployNewGatekeeper(): VaultFactory.VaultCreatedEventResponse {
        if (vault != null || gatekeeper != null) {
            throw RuntimeException("vault already deployed")
        }
        val receipt = vaultFactory.newVault().send()
        val vaultCreatedEvents = vaultFactory.getVaultCreatedEvents(receipt)
        assert(vaultCreatedEvents.size == 1)
        val event = vaultCreatedEvents[0]
        vault = Vault.load(event.vault, web3j, credentials, provider)
//        vault!!.transferERC20("0xf0d5bc18421fa04d0a2a2ef540ba5a9f04014be3", BigInteger.ONE, Address.DEFAULT.toString(), BigInteger.ONE, Address.DEFAULT.toString()).send()
        return event!!
    }

    fun initialConfig(vaultAddress: String, initialParticipants: List<String>, initialDelays: List<String>) {

        val initialParticipantsByteArray: List<ByteArray> = initialParticipants.map { Numeric.hexStringToByteArray(it) }
        val initialDelaysBigInteger: List<BigInteger> = initialDelays.map {
            if (Numeric.containsHexPrefix(it)) {
                BigInteger(it, 16)
            } else {
                BigInteger(it)
            }
        }
        gatekeeper!!.initialConfig(vaultAddress, initialParticipantsByteArray, initialDelaysBigInteger)

    }
}
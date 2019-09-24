package com.tabookey.safechannels.platforms

import com.tabookey.duplicated.EthereumAddress
import com.tabookey.duplicated.IKredentials
import com.tabookey.duplicated.VaultParticipantTuple
import kotlin.js.Promise

// TODO: not create instances with kotlin, run constructors in JS instead.
actual class InteractorsFactory(
        private val ethNodeUrl: String,
        private val networkId: Int) {

    companion object {
        private const val REQUIRE_VF_INTERACTOR_JS_CODE = "js_foundation/src/js/VaultFactoryContractInteractorPromises"
        private const val REQUIRE_V_INTERACTOR_JS_CODE = "js_foundation/src/js/VaultContractInteractorWithPromises"
    }

    actual fun interactorForVaultFactory(kredentials: IKredentials, vaultFactoryAddress: String): VaultFactoryContractInteractor {
        val connect = require(REQUIRE_VF_INTERACTOR_JS_CODE).connect
        val nativeInteractor = connect(kredentials, vaultFactoryAddress, ethNodeUrl, networkId)
        @Suppress("UnsafeCastFromDynamic")
        return VaultFactoryContractInteractor(nativeInteractor)
    }


    actual fun interactorForVault(
            kredentials: IKredentials,
            vaultAddress: String,
            gkAddress: String,
            participant: VaultParticipantTuple): VaultContractInteractor {
        val connect = require(REQUIRE_V_INTERACTOR_JS_CODE).connect
        val nativeInteractor = connect(kredentials,
                participant.permissions.toString(),
                participant.level.toString(),
                ethNodeUrl, gkAddress, vaultAddress)
        @Suppress("UnsafeCastFromDynamic")
        return VaultContractInteractor(nativeInteractor)
    }

    actual suspend fun deployNewVaultFactory(from: EthereumAddress): String {
        val deployNewVaultFactory =
                require(REQUIRE_VF_INTERACTOR_JS_CODE).deployNewVaultFactory
                        as (String, String) -> Promise<String>
        return deployNewVaultFactory(from, ethNodeUrl).await()
    }

}
package com.tabookey.safechannels

import com.nhaarman.mockitokotlin2.*
import com.tabookey.duplicated.ConfigPendingEventResponse
import com.tabookey.foundation.InteractorsFactory
import com.tabookey.foundation.Response
import com.tabookey.foundation.VaultContractInteractor
import com.tabookey.foundation.VaultFactoryContractInteractor
import com.tabookey.safechannels.vault.VaultStorageInterface
import kotlinx.coroutines.runBlocking
import org.mockito.ArgumentMatchers


class SDKEnvironmentMock {

    private val anyTxHash = "0x46784678486746783473567567d216153c06e857cd7f72665e0af1d7d82172f494"
    val anyAddress = "0xd216153c06e857cd7f72665e0af1d7d82172f494"
    val anyVault = "0x1116153c06e857cd7f72665e0af1d7d82172f494"
    val anyGatekeeper = "0x2226153c06e857cd7f72665e0af1d7d82172f494"
    internal val anyStateId = "777"
    internal val futureDueTime = (System.currentTimeMillis() + 2_000_000).toString()
    private val pastDueTime = (System.currentTimeMillis() - 2_000_000).toString()

    internal val transactionChangeHash = ByteArray(10) { i -> return@ByteArray i.toByte() }
    private val configPendingEventResponse = ConfigPendingEventResponse(
            transactionChangeHash,
            anyAddress, "0x1234", "", "",
            anyStateId, mutableListOf(), mutableListOf()
    )

    var storage: VaultStorageInterface = spy(InMemoryStorage())
//    var credentials: Credentials = mock()

    var vaultFactoryContractInteractor: VaultFactoryContractInteractor
    var interactor: VaultContractInteractor
    var interactorsFactory: InteractorsFactory


    init {

        vaultFactoryContractInteractor = mock {
            on {
                runBlocking { deployNewGatekeeper() }
            } doReturn Response(anyTxHash, anyAddress, anyGatekeeper, anyVault)
        }

        interactor = mock {

            on { runBlocking { changeConfiguration(any(), any(), any()) } } doReturn "0x_scheduled_tx_hash"
            on {
                runBlocking {
                    applyPendingConfigurationChange(any())
                }
            } doReturn "0x_apply_config_tx_hash"
        }

        interactorsFactory = mock {
            on { interactorForVault(any(), any(), any(), any()) } doReturn interactor
            on { interactorForVaultFactory(any(), any()) } doReturn vaultFactoryContractInteractor
        }

    }

    internal fun configPendingEventOn(isDue: Boolean = false) {
        whenever(
                interactor.getConfigPendingEvent(txHash = ArgumentMatchers.anyString())
        ).thenReturn(
                configPendingEventResponse
        )
        val time = if (isDue) pastDueTime else futureDueTime
        whenever(
                interactor.getPendingChangeDueTime(configChangeHash = any())
        ).thenReturn(time)
    }
}
package com.tabookey.safechannels

import com.nhaarman.mockitokotlin2.*
import com.tabookey.duplicated.*
import com.tabookey.foundation.InteractorsFactory
import com.tabookey.foundation.Response
import com.tabookey.foundation.VaultContractInteractor
import com.tabookey.foundation.VaultFactoryContractInteractor
import com.tabookey.foundation.generated.VaultFactory
import com.tabookey.safechannels.vault.VaultStorageInterface
import kotlinx.coroutines.runBlocking
import org.mockito.ArgumentMatchers


class SDKEnvironmentMock {

    private val anyTxHash = "0x46784678486746783473567567d216153c06e857cd7f72665e0af1d7d82172f494"


    companion object {
        const val ownerAccountPrivateKey = "f2e1090982b06f29043f76edb2265c8bbd6ee09d06d2b8ca19298008afc6ccdb"
        const val ownerAccountPublicKey = "e819a43d9a9725ed75936f4a886678ee385b7ee19a3081cf7c7d0b020ce690888ac5ae0dc78f75069591bdf757c8b37af27175c673924cf8ffd5fea57c0aa0e7"
    }
    val ownerAddress1 = "0x644f2eab5fa125c3df720c0c20878eabf735679a"

    val anyAddress = "0xd216153c06e857cd7f72665e0af1d7d82172f494"
    val anyVault = "0x1116153c06e857cd7f72665e0af1d7d82172f494"
    val anyGatekeeper = "0x2226153c06e857cd7f72665e0af1d7d82172f494"
    internal val anyStateId = "777"
    internal val futureDueTime = (System.currentTimeMillis() + 2_000_000).toString()
    private val pastDueTime = (System.currentTimeMillis() - 2_000_000).toString()

    internal val transactionChangeHash = ByteArray(10) { i -> return@ByteArray i.toByte() }
    private val configPendingEventResponse = ConfigPendingEventResponse(
            anyTxHash,
            transactionChangeHash,
            anyAddress, "0x1234", "", "",
            anyStateId, mutableListOf(), mutableListOf()
    )

    var storage: VaultStorageInterface = spy(InMemoryStorage())

    private var vaultFactoryContractInteractor: VaultFactoryContractInteractor
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
            on { interactorForVaultFactory(any()) } doReturn vaultFactoryContractInteractor
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

    internal fun simulateVaultState() {
        val events = listOf(
                VaultCreatedEventResponse(vault = anyVault, gatekeeper = anyGatekeeper, transactionHash = anyTxHash),
                GatekeeperInitializedEventResponse(anyTxHash, anyVault, emptyList()),
                ConfigPendingEventResponse(anyTxHash, transactionChangeHash, anyAddress, "", anyAddress, "", "", emptyList(), emptyList()),
                mock<ParticipantAddedEventResponse>(),
                ConfigPendingEventResponse(anyTxHash, transactionChangeHash, anyAddress, "", anyAddress, "", "", emptyList(), emptyList()),
                mock<ParticipantRemovedEventResponse>(),
                ConfigPendingEventResponse(anyTxHash, transactionChangeHash, anyAddress, "", anyAddress, "", "", emptyList(), emptyList()),
                mock<OwnerChangedEventResponse>()
        )
        whenever(
                interactor.getPastEvents()
        ).thenReturn(
                events
        )


        whenever(
                interactor.getConfigPendingEvent(txHash = ArgumentMatchers.anyString())
        ).thenReturn(
                configPendingEventResponse
        )
        whenever(
                interactor.getPendingChangeDueTime(configChangeHash = any())
        ).thenReturn(pastDueTime)
    }
}
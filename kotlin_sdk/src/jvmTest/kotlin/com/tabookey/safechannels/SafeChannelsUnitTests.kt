package com.tabookey.safechannels

import com.tabookey.safechannels.vault.LocalChangeType
import com.tabookey.safechannels.vault.LocalVaultChange
import com.tabookey.safechannels.vault.VaultStorageInterface
import org.junit.Before
import org.mockito.Mockito
import org.mockito.Mockito.*
import kotlin.test.Test
import kotlin.test.assertEquals

class SafeChannelsUnitTests {

    // From: https://medium.com/@elye.project/befriending-kotlin-and-mockito-1c2e7b0ef791
    // Mockito does not know about Kotlin's nullable types
    private fun <T> any() = Mockito.any() as T

    lateinit var vaultFactoryContractInteractor: VaultFactoryContractInteractor
    lateinit var sdk: SafeChannels
    lateinit var storage: VaultStorageInterface

    @Before
    fun before() {
        vaultFactoryContractInteractor = Mockito.spy(VaultFactoryContractInteractor())
        storage = Mockito.spy(InMemoryStorage())
        sdk = SafeChannels(vaultFactoryContractInteractor, storage)
    }

    @Test
    fun `should create a new keypair and store it`() {
        var ownedAccounts = sdk.listAllOwnedAccounts()
        reset(storage)
        assertEquals(0, ownedAccounts.size)
        val account = sdk.createKeypair()
        verify(storage).generateKeypair()
        ownedAccounts = sdk.listAllOwnedAccounts()
        verify(storage).getAllOwnedAccounts()
        assertEquals(1, ownedAccounts.size)
        assertEquals(account, ownedAccounts[0])
    }


    @Test
    fun `should create a new vault and save it in the storage`() {
        // There are no vaults in the SDK
        var allVaults = sdk.listAllVaults()
        assertEquals(0, allVaults.size)
        verify(storage, never()).putVaultState(any())
        val vault = sdk.vaultConfigBuilder()
        verify(storage, times(1)).putVaultState(any())
        // One vault was created
        allVaults = sdk.listAllVaults()
        assertEquals(1, allVaults.size)
        val localChanges = vault.getVaultState().getLocalChanges()
        assertEquals(1, localChanges.size)
        assertEquals(LocalChangeType.INITIALIZE, localChanges[0].changeType)

        // The data is accessible from a new object that holds the same storage instance
        // TODO: need to replace the in-memory storage with something file-based. In-memory one keeps references to objects so this is not testing much.
        val tempSdk = SafeChannels(vaultFactoryContractInteractor, storage)
        val tempLocalChanges = tempSdk.listAllVaults()[0].getVaultState().getLocalChanges()
        assertEquals(1, tempLocalChanges.size)
        assertEquals(LocalChangeType.INITIALIZE, tempLocalChanges[0].changeType)

    }
}
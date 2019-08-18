package com.tabookey.safechannels

import com.tabookey.safechannels.addressbook.AddressBookEntry
import com.tabookey.safechannels.vault.LocalChangeType
import com.tabookey.safechannels.vault.VaultPermissions
import org.mockito.Mockito
import org.mockito.Mockito.*
import kotlin.test.Test
import kotlin.test.assertEquals

class SafeChannelsUnitTests {

    // From: https://medium.com/@elye.project/befriending-kotlin-and-mockito-1c2e7b0ef791
    // Mockito does not know about Kotlin's nullable types
    private fun <T> any() = Mockito.any() as T

    val anyAddress = "0xd216153c06e857cd7f72665e0af1d7d82172f494"
    /**
     * If I create a new 'context' for tests each time, tests are somewhat more repetitive, but at least they are not
     * interdependent as Truffle tests are, right?
     */
    private fun newTestSDK(): Triple<VaultFactoryContractInteractor, InMemoryStorage, SafeChannels> {
        val vaultFactoryContractInteractor = spy(VaultFactoryContractInteractor())
        val storage = spy(InMemoryStorage())
        val sdk = SafeChannels(vaultFactoryContractInteractor, storage)
        return Triple(vaultFactoryContractInteractor, storage, sdk)
    }

    @Test
    fun `should create a new keypair and store it`() {
        val (vaultFactoryContractInteractor, storage, sdk) = newTestSDK()

        print(vaultFactoryContractInteractor)
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
        val (vaultFactoryContractInteractor, storage, sdk) = newTestSDK()

        // There are no vaults in the SDK
        var allVaults = sdk.listAllVaults()
        assertEquals(0, allVaults.size)
        verify(storage, never()).putVaultState(any())
        val vaultConfigBuilder = sdk.vaultConfigBuilder()
        verify(storage, times(1)).putVaultState(any())
        // One vault was created
        allVaults = sdk.listAllVaults()
        assertEquals(1, allVaults.size)
        val localChanges = vaultConfigBuilder.getVaultState().getLocalChanges()
        assertEquals(1, localChanges.size)
        assertEquals(LocalChangeType.INITIALIZE, localChanges[0].changeType)

        // The data is accessible from a new object that holds the same storage instance
        // TODO: need to replace the in-memory storage with something file-based. In-memory one keeps references to objects so this is not testing much.
        val tempSdk = SafeChannels(vaultFactoryContractInteractor, storage)
        val tempLocalChanges = tempSdk.listAllVaults()[0].getVaultState().getLocalChanges()
        assertEquals(1, tempLocalChanges.size)
        assertEquals(LocalChangeType.INITIALIZE, tempLocalChanges[0].changeType)
    }

    @Test
    fun `should save new entries in the address book`(){
        val (vaultFactoryContractInteractor, storage, sdk) = newTestSDK()
        val addressBook = sdk.getAddressBook()
        // There are no entries in the address book
        var addresses = addressBook.getAllKnownAddresses()
        assertEquals(0, addresses.size)
        addressBook.saveNewAddress("Contact One", anyAddress, AddressBookEntry.AddressContactType.EOA)
        verify(storage, times(1)).putAddressBookEntry(any())
        addresses = addressBook.getAllKnownAddresses()
        assertEquals(1, addresses.size)

    }

    @Test
    fun `should configure and deploy vault to the blockchain with correct configuration`(){
        val (vaultFactoryContractInteractor, storage, sdk) = newTestSDK()
        val vaultConfigBuilder = sdk.vaultConfigBuilder()
        val entry = sdk.getAddressBook()
                .saveNewAddress("Contact One", anyAddress, AddressBookEntry.AddressContactType.EOA)
        val permissions = VaultPermissions.ADMIN_PERMISSIONS
        permissions.addPermission(VaultPermissions.Permission.canSpend) // Note: this should not work with the current contract
        vaultConfigBuilder.addParticipant(entry, permissions)
        val localChanges = sdk.listAllVaults()[0].getVaultState().getLocalChanges()
        assertEquals(2, localChanges.size)
        assertEquals(LocalChangeType.INITIALIZE, localChanges[0].changeType)
        assertEquals(LocalChangeType.ADD_PARTICIPANT, localChanges[1].changeType)
        assertEquals(anyAddress, localChanges[1].participant.address)
        assertEquals(permissions, localChanges[1].permissions)
    }
}
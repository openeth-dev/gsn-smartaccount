package com.tabookey.safechannels

import com.nhaarman.mockitokotlin2.*
import com.tabookey.duplicated.VaultParticipant
import com.tabookey.duplicated.VaultPermissions
import com.tabookey.safechannels.addressbook.SafechannelContact
import com.tabookey.safechannels.vault.localchanges.AddParticipantChange
import com.tabookey.safechannels.vault.localchanges.InitializeVaultChange
import com.tabookey.safechannels.vault.localchanges.LocalChangeType
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFails

class BootstrapUnitTest : SafeChannelsUnitTests() {

    @Test
    fun `should create a new keypair and store it`() {
        var ownedAccounts = sdk.listAllOwnedAccounts()
        reset(env.storage)
        assertEquals(0, ownedAccounts.size, "SDK must start without owned accounts")
        val account = sdk.createKeypair()
        verify(env.storage).generateKeypair()
        ownedAccounts = sdk.listAllOwnedAccounts()
        verify(env.storage).getAllOwnedAccounts()
        assertEquals(1, ownedAccounts.size, "SDK must have one owned account")
        assertEquals(account.getAddress(), ownedAccounts[0].getAddress(), "Saved account address does not match the returned one")
    }

    @Test
    fun `should create a new vault and save it in the storage`() = runTest {
        // There are no vaults in the SDK
        var allVaults = sdk.loadAllVaultsFromStorage()
        assertEquals(0, allVaults.size, "SDK must start without vaults")
        verify(env.storage, never()).putVaultState(any())
        val kredentials = sdk.createKeypair()
        val vaultConfigBuilder = sdk.createLocalVault(kredentials.getAddress())
        sdk.saveLocalState()
        // One vault was created
        allVaults = sdk.loadAllVaultsFromStorage()
        assertEquals(1, allVaults.size, "SDK must have one vault under construction")
        val localChanges = vaultConfigBuilder.vaultState.localChanges
        assertEquals(1, localChanges.size)
        assertEquals(LocalChangeType.INITIALIZE, localChanges[0].changeType)

        // The data is accessible from a new object that holds the same storage instance
        // TODO: need to replace the in-memory storage with something file-based. In-memory one keeps references to objects so this is not testing much.
        val tempSdk = SafeChannels(env.interactorsFactory, env.storage)
        val tempLocalChanges = tempSdk.loadAllVaultsFromStorage()[0].vaultState.localChanges
        assertEquals(1, tempLocalChanges.size)
        assertEquals(LocalChangeType.INITIALIZE, tempLocalChanges[0].changeType)
    }

    @Test
    fun `should save new entries in the address book`() {
        val addressBook = sdk.getAddressBook()
        // There are no entries in the address book
        var addresses = addressBook.getAllEntities()
        assertEquals(0, addresses.size)

        // cannot store addresses with no relation to some vault
        val kredentials = sdk.createKeypair()
        val builder = sdk.createLocalVault(kredentials.getAddress())
        val contact = SafechannelContact("guid, shmuid", "Contact One")
        contact.addParticipantTuple(builder.vaultState.vaultId, VaultParticipant(VaultPermissions.ADMIN_PERMISSIONS, 2, env.anyAddress))
        addressBook.addNewContact(contact)
        verify(env.storage, times(1)).putAddressBookEntry(any())
        addresses = addressBook.getAllEntities()
        assertEquals(1, addresses.size)
    }

    @Test
    fun `should not allow creation of the builder when no keypair exists`() {
        val throwable = assertFails {
            sdk.createLocalVault(env.anyAddress)
        }
        assertEquals("Unknown account passed as owner", throwable.message)
    }

    @Test
    fun `should allow to configure the vault before deploying it to the blockchain`() = runTest {
        val kredentials = sdk.createKeypair()
        val vaultConfigBuilder = sdk.createLocalVault(kredentials.getAddress())
        val participant = VaultParticipant(VaultPermissions.ADMIN_PERMISSIONS, 2, env.anyAddress)
        // Note: 'copyAndMergePermissions' should not work with the current contract. Test only.
        val permissions = VaultPermissions.ADMIN_PERMISSIONS.copyAndMergePermissions(VaultPermissions.Permission.canSpend)
        vaultConfigBuilder.addParticipant(participant.address, permissions)

        val localChanges = sdk.loadAllVaultsFromStorage()[0].vaultState.localChanges
        assertEquals(2, localChanges.size, "Must have local changes")

        val initializeChange = localChanges[0] as InitializeVaultChange
        assertEquals(LocalChangeType.INITIALIZE, initializeChange.changeType)
        assertEquals(kredentials.getAddress(), initializeChange.participant)

        val addParticipantChange = localChanges[1] as AddParticipantChange
        assertEquals(LocalChangeType.ADD_PARTICIPANT, addParticipantChange.changeType)
        assertEquals(env.anyAddress, addParticipantChange.participant)
        assertEquals(permissions, addParticipantChange.permissions)
    }

    @Test
    fun `should deploy the vault with a primitive configuration`() = runTest {
        val kredentials = sdk.createKeypair()
        val vaultConfigBuilder = sdk.createLocalVault(kredentials.getAddress())
        val deployedVault = vaultConfigBuilder.deployVault()
        assertEquals(env.anyVault, deployedVault.vaultState.address)
        assertEquals(env.anyGatekeeper, deployedVault.vaultState.gatekeeperAddress)

        sdk.saveLocalState()
        val allVaults = sdk.loadAllVaultsFromStorage()
        assertEquals(1, allVaults.size, "SDK must have one vault being deployed")
        assertEquals(allVaults[0].vaultState.vaultId, deployedVault.vaultState.vaultId)

        assertEquals(allVaults[0].vaultState.address, deployedVault.vaultState.address)
        assertEquals(allVaults[0].vaultState.gatekeeperAddress, deployedVault.vaultState.gatekeeperAddress)

        val changes = deployedVault.vaultState.localChanges
        assertEquals(0, changes.size, "Freshly deployed vault must not have any local changes")
    }
}
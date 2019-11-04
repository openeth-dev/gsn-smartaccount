package com.tabookey.safechannels

import com.nhaarman.mockitokotlin2.*
import com.tabookey.duplicated.VaultParticipantTuple
import com.tabookey.duplicated.VaultPermissions
import com.tabookey.duplicated.VaultPermissions.Companion.ADMIN_PERMISSIONS
import com.tabookey.safechannels.addressbook.SafechannelContact
import com.tabookey.safechannels.extensions.toHexString
import com.tabookey.safechannels.vault.DeployedVault
import com.tabookey.safechannels.vault.localchanges.*
import com.tabookey.safechannels.vault.localchanges.LocalChangeType.ADD_PARTICIPANT
import com.tabookey.safechannels.vault.localchanges.LocalChangeType.INITIALIZE
import kotlinx.coroutines.runBlocking
import org.junit.Before
import org.junit.Ignore
import org.mockito.ArgumentMatchers.anyString
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFails

class SafeChannelsUnitTests {

    private lateinit var env: SDKEnvironmentMock
    private lateinit var sdk: SafeChannels

    @Before
    fun before() {
        env = SDKEnvironmentMock()
        sdk = SafeChannels(env.interactorsFactory, env.anyAddress, env.storage)
    }

    @Test
    fun `should create a new keypair and store it`() {
        var ownedAccounts = sdk.listAllOwnedAccounts()
        reset(env.storage)
        assertEquals(0, ownedAccounts.size)
        val account = sdk.createKeypair()
        verify(env.storage).generateKeypair()
        ownedAccounts = sdk.listAllOwnedAccounts()
        verify(env.storage).getAllOwnedAccounts()
        assertEquals(1, ownedAccounts.size)
        assertEquals(account.getAddress(), ownedAccounts[0].getAddress())
    }

    @Test
    fun `should create a new vault and save it in the storage`() = runTest {
        // There are no vaults in the SDK
        var allVaults = sdk.getAllVaults()
        assertEquals(0, allVaults.size)
        verify(env.storage, never()).putVaultState(any())
        val kredentials = sdk.createKeypair()
        val vaultConfigBuilder = sdk.vaultConfigBuilder(kredentials.getAddress())
        verify(env.storage, times(1)).putVaultState(any())
        // One vault was created
        allVaults = sdk.getAllVaults()
        assertEquals(1, allVaults.size)
        val localChanges = vaultConfigBuilder.getVaultLocalState().localChanges
        assertEquals(1, localChanges.size)
        assertEquals(INITIALIZE, localChanges[0].changeType)

        // The data is accessible from a new object that holds the same storage instance
        // TODO: need to replace the in-memory storage with something file-based. In-memory one keeps references to objects so this is not testing much.
        val tempSdk = SafeChannels(env.interactorsFactory, env.anyAddress, env.storage)
        val tempLocalChanges = tempSdk.getAllVaults()[0].getVaultLocalState().localChanges
        assertEquals(1, tempLocalChanges.size)
        assertEquals(INITIALIZE, tempLocalChanges[0].changeType)
    }

    @Test
    fun `should save new entries in the address book`() {
        val addressBook = sdk.getAddressBook()
        // There are no entries in the address book
        var addresses = addressBook.getAllEntities()
        assertEquals(0, addresses.size)

        // cannot store addresses with no relation to some vault
        val kredentials = sdk.createKeypair()
        val builder = sdk.vaultConfigBuilder(kredentials.getAddress())
        val contact = SafechannelContact("guid, shmuid", "Contact One")
        contact.addParticipantTuple(builder.vaultState.id!!, VaultParticipantTuple(ADMIN_PERMISSIONS, 2, env.anyAddress))
        addressBook.addNewContact(contact)
        verify(env.storage, times(1)).putAddressBookEntry(any())
        addresses = addressBook.getAllEntities()
        assertEquals(1, addresses.size)
    }

    @Test
    fun `should not allow creation of the builder when no keypair exists`() {
        val throwable = assertFails {
            sdk.vaultConfigBuilder(env.anyAddress)
        }
        assertEquals("Unknown account passed as owner", throwable.message)
    }

    @Test
    fun `should allow to configure the vault before deploying it to the blockchain`() = runTest {
        val kredentials = sdk.createKeypair()
        val vaultConfigBuilder = sdk.vaultConfigBuilder(kredentials.getAddress())
        val contact = SafechannelContact("guid, shmuid", "Contact One")
        val id = vaultConfigBuilder.vaultState.id
        contact.addParticipantTuple(id!!, VaultParticipantTuple(ADMIN_PERMISSIONS, 2, env.anyAddress))
        val adminPermissions = ADMIN_PERMISSIONS
        adminPermissions.addPermission(VaultPermissions.Permission.canSpend) // Note: this should not work with the current contract
        val participant = contact.participantTuples[id]!![0].address
        vaultConfigBuilder.addParticipant(participant, adminPermissions)
        // TODO: maybe it should not allow creation of new builder if no account is created

        val localChanges = sdk.getAllVaults()[0].getVaultLocalState().localChanges
        assertEquals(2, localChanges.size)

        val initializeChange = localChanges[0] as InitializeVaultChange
        assertEquals(INITIALIZE, initializeChange.changeType)
        assertEquals(kredentials.getAddress(), initializeChange.participant)

        val addParticipantChange = localChanges[1] as AddParticipantChange
        assertEquals(ADD_PARTICIPANT, addParticipantChange.changeType)
        assertEquals(env.anyAddress, addParticipantChange.participant)
        assertEquals(adminPermissions, addParticipantChange.permissions)
    }

    @Test
    fun `should deploy the vault with the corresponding configuration`() = runTest {
        val kredentials = sdk.createKeypair()
        val vaultConfigBuilder = sdk.vaultConfigBuilder(kredentials.getAddress())
        // TODO: more advanced configurations! :-)
        val deployedVault = vaultConfigBuilder.deployVault()
        assertEquals(env.anyVault, deployedVault.vaultState.address)
        assertEquals(env.anyGatekeeper, deployedVault.vaultState.gatekeeperAddress)

        val allVaults = sdk.getAllVaults()
        assertEquals(1, allVaults.size)
        assertEquals(allVaults[0].vaultState.id, deployedVault.vaultState.id)

        assertEquals(allVaults[0].vaultState.address, deployedVault.vaultState.address)
        assertEquals(allVaults[0].vaultState.gatekeeperAddress, deployedVault.vaultState.gatekeeperAddress)

        val changes = deployedVault.getVaultLocalState().localChanges
        assertEquals(0, changes.size)
    }

    private suspend fun quickDeployVault(): DeployedVault {
        val kredentials = sdk.createKeypair()
        val vaultConfigBuilder = sdk.vaultConfigBuilder(kredentials.getAddress())
        return vaultConfigBuilder.deployVault()
    }

    // As operator:
    @Test
    fun `should schedule, commit and wait for a config change (adding participant to existing vault)`() = runTest {
        val deployedVault = quickDeployVault()
        // ignore method calls on a spy storage before the interesting part of the test
        reset(env.storage)

        // First, create a local change request to add a participant
        val addedChange = deployedVault.addParticipant(env.anyAddress, ADMIN_PERMISSIONS)
        assertEquals(
                ADD_PARTICIPANT,
                addedChange.changeType,
                "does not return the correct change object")
        val localState = deployedVault.getVaultLocalState()

        // Check that the correct vault state was passed the storage
        verify(env.storage, times(1)).putVaultState(localState)

        var changes = localState.localChanges
        assertEquals(1, changes.size, "local state does not contain the change")

        val expectedChange = changes[0] as AddParticipantChange
        assertEquals(ADD_PARTICIPANT, expectedChange.changeType)
        assertEquals(env.anyAddress, expectedChange.participant)

        env.configPendingEventOn()

        // Check that SDK returns expected data correctly
        val pendingChange = deployedVault.commitLocalChanges(env.anyStateId)
        assertEquals("0x_scheduled_tx_hash", pendingChange.transaction.hash)
        assertEquals(env.futureDueTime, pendingChange.dueTime)
        assertEquals(env.anyStateId, pendingChange.event.stateId)

        changes = deployedVault.getVaultLocalState().localChanges
        assertEquals(0, changes.size, "committing local changes does not clean up the state")
    }

    @Test
    fun `should refuse to apply a change that is not yet due`() = runTest {
        val vault = quickDeployVault()
        vault.addParticipant(env.anyAddress, ADMIN_PERMISSIONS)
        env.configPendingEventOn()
        val pendingChange = vault.commitLocalChanges(env.anyStateId)

        val throwable = assertFails {
            runBlocking {
                vault.applyPendingChange(pendingChange)
            }
        }
        assertEquals("The change you are trying to apply is not past the delay period", throwable.message)
    }

    @Test
    fun `should apply a change that is due`() = runTest {
        val vault = quickDeployVault()
        vault.addParticipant(env.anyAddress, ADMIN_PERMISSIONS)
        env.configPendingEventOn(isDue = true)
        val pendingChange = vault.commitLocalChanges(env.anyStateId)
        val transaction = vault.applyPendingChange(pendingChange)
        assertEquals("0x_apply_config_tx_hash", transaction.hash)
    }

    @Ignore
    @Test
    fun `should remove participant from existing vault`() {
    }

    // Cannot return null because this is Kotlin (and it is good)
    @Ignore
    @Test
    fun `should throw when trying to commit while not having local changes`() {
    }

    @Test
    fun `should schedule ether transfer`() = runTest {
        val deployedVault = quickDeployVault()
        val amountToTransfer = "1200000000000000000" // 1.2 ether
        val destination = env.anyAddress
        val localChange = deployedVault.transferEth(amountToTransfer, destination)
        assertEquals(LocalChangeType.TRANSFER_ETH, localChange.changeType)

        val change = deployedVault.getVaultLocalState().localChanges[0] as EtherTransferChange
        assertEquals(amountToTransfer, change.amount)
        assertEquals(destination, change.destination)
        assertEquals(ETH_TOKEN_ADDRESS, change.token)

        val dueTime = "200"
        whenever(env.interactor.sendEther(anyString(), anyString(), anyString(), anyString())).thenReturn("0xether_transfer_hash")
        env.configPendingEventOn()

        val pendingChanges = deployedVault.commitLocalTransfers(env.anyStateId)
        assertEquals(1, pendingChanges.size)
        val pendingChange = pendingChanges[0]
        val expectedHashStr = env.transactionChangeHash.toHexString()
        val actualHashStr = pendingChange.event.transactionHash.toHexString()
        assertEquals(expectedHashStr, actualHashStr, "Transaction hash does not match")
    }

    @Ignore
    @Test
    fun `should send erc20 token`() {
    }

    @Ignore
    @Test
    fun `should cancel ether transfer`() {
    }

    @Ignore
    @Test
    fun `should cancel erc20 token transfer`() {
    }

    @Ignore
    @Test
    fun `should cancel config changes as owner`() {
    }

    @Ignore
    @Test
    fun `should perform boosted config change`() {
    }

    @Ignore
    @Test
    fun `should use recovery-only(level zero) admins to for simplified recovery procedure`() {
    }

    @Ignore
    @Test
    fun `should freeze recovery-only(level zero) admins`() {
    }

    // As watchdog:
    @Ignore
    @Test
    fun `should cancel config changes as watchdog`() {
    }

    @Ignore
    @Test
    fun `should freeze`() {
    }

    // As admin:
    @Ignore
    @Test
    fun `should boost config change`() {
    }

    @Ignore
    @Test
    fun `should recover operator`() {
    }

    // Shared tests for guardians:
    @Ignore
    @Test
    fun `should add vault to watched vaults as participant`() {
    }

    @Ignore
    @Test
    fun `should remove vault from watched vaults as participant`() {
    }

    @Ignore
    @Test
    fun `should list all watched vaults`() {
    }
}
package com.tabookey.safechannels

import com.nhaarman.mockitokotlin2.*
import com.tabookey.duplicated.ConfigPendingEventResponse
import com.tabookey.duplicated.VaultParticipantTuple
import com.tabookey.duplicated.VaultPermissions
import com.tabookey.foundation.InteractorsFactory
import com.tabookey.foundation.Response
import com.tabookey.foundation.VaultContractInteractor
import com.tabookey.foundation.VaultFactoryContractInteractor
import com.tabookey.safechannels.addressbook.SafechannelContact
import com.tabookey.safechannels.extensions.toHexString
import com.tabookey.safechannels.vault.DeployedVault
import com.tabookey.safechannels.vault.VaultStorageInterface
import com.tabookey.safechannels.vault.localchanges.*
import kotlinx.coroutines.runBlocking
import org.junit.Before
import org.junit.Ignore
import org.mockito.ArgumentMatchers.anyString
import org.web3j.crypto.Credentials
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFails

class SafeChannelsUnitTests {

    // From: https://medium.com/@elye.project/befriending-kotlin-and-mockito-1c2e7b0ef791
    // Mockito does not know about Kotlin's nullable types
//    private fun <T> any() = Mockito.any() as T

    private val anyAddress = "0xd216153c06e857cd7f72665e0af1d7d82172f494"
    private val anyStateId = "777"

    private lateinit var vaultFactoryContractInteractor: VaultFactoryContractInteractor
    private lateinit var interactor: VaultContractInteractor
    private lateinit var storage: VaultStorageInterface
    private lateinit var interactorsFactory: InteractorsFactory
    private lateinit var sdk: SafeChannels
    private lateinit var credentials: Credentials

    private val transactionChangeHash = ByteArray(10) { i -> return@ByteArray i.toByte() }
    private val configPendingEventResponse = ConfigPendingEventResponse(
            transactionChangeHash,
            "", "", "", "",
            anyStateId, mutableListOf(), mutableListOf()
    )

    @Before
    fun before() {
        storage = spy(InMemoryStorage())
        credentials = mock()
        vaultFactoryContractInteractor = mock {
            on {
                runBlocking { deployNewGatekeeper() }
            } doReturn Response("hi", "", "", "")

        }

        interactor = mock {

            on { runBlocking { changeConfiguration(any(), any(), any()) } } doReturn "0x_scheduled_tx_hash"
        }

        interactorsFactory = mock {
            on { interactorForVault(any(), any(), any(), any()) } doReturn interactor
        }
        sdk = SafeChannels(interactorsFactory, vaultFactoryContractInteractor, storage)
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
        assertEquals(account.getAddress(), ownedAccounts[0].getAddress())
    }

    @Test
    fun `should create a new vault and save it in the storage`() {
        // There are no vaults in the SDK
        var allVaults = sdk.listAllVaults()
        assertEquals(0, allVaults.size)
        verify(storage, never()).putVaultState(any())
        val kredentials = sdk.createKeypair()
        val vaultConfigBuilder = sdk.vaultConfigBuilder(kredentials.getAddress())
        verify(storage, times(1)).putVaultState(any())
        // One vault was created
        allVaults = sdk.listAllVaults()
        assertEquals(1, allVaults.size)
        val localChanges = vaultConfigBuilder.getVaultLocalState().localChanges
        assertEquals(1, localChanges.size)
        assertEquals(LocalChangeType.INITIALIZE, localChanges[0].changeType)

        // The data is accessible from a new object that holds the same storage instance
        // TODO: need to replace the in-memory storage with something file-based. In-memory one keeps references to objects so this is not testing much.
        val tempSdk = SafeChannels(interactorsFactory, vaultFactoryContractInteractor, storage)
        val tempLocalChanges = tempSdk.listAllVaults()[0].getVaultLocalState().localChanges
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
        val builder = sdk.vaultConfigBuilder(kredentials.getAddress())
        val contact = SafechannelContact("guid, shmuid", "Contact One")
        contact.addParticipantTuple(builder.vaultState.id!!, VaultParticipantTuple(VaultPermissions.ADMIN_PERMISSIONS, 2, anyAddress))
        addressBook.addNewContact(contact)
        verify(storage, times(1)).putAddressBookEntry(any())
        addresses = addressBook.getAllEntities()
        assertEquals(1, addresses.size)
    }

    @Test
    fun `should not allow creation of the builder when no keypair exists`() {
        val throwable = assertFails {
            sdk.vaultConfigBuilder(anyAddress)
        }
        assertEquals("Unknown account passed as owner", throwable.message)
    }

    @Test
    fun `should allow to configure the vault before deploying it to the blockchain`() {
        val kredentials = sdk.createKeypair()
        val vaultConfigBuilder = sdk.vaultConfigBuilder(kredentials.getAddress())
        val contact = SafechannelContact("guid, shmuid", "Contact One")
        val id = vaultConfigBuilder.vaultState.id
        contact.addParticipantTuple(id!!, VaultParticipantTuple(VaultPermissions.ADMIN_PERMISSIONS, 2, anyAddress))
        val adminPermissions = VaultPermissions.ADMIN_PERMISSIONS
        adminPermissions.addPermission(VaultPermissions.Permission.canSpend) // Note: this should not work with the current contract
        val participant = contact.participantTuples[id]!![0].address
        vaultConfigBuilder.addParticipant(participant, adminPermissions)
        // TODO: maybe it should not allow creation of new builder if no account is created

        val localChanges = sdk.listAllVaults()[0].getVaultLocalState().localChanges
        assertEquals(2, localChanges.size)

        val initializeChange = localChanges[0] as InitializeVaultChange
        assertEquals(LocalChangeType.INITIALIZE, initializeChange.changeType)
        assertEquals(kredentials.getAddress(), initializeChange.participant)

        val addParticipantChange = localChanges[1] as AddParticipantChange
        assertEquals(LocalChangeType.ADD_PARTICIPANT, addParticipantChange.changeType)
        assertEquals(anyAddress, addParticipantChange.participant)
        assertEquals(adminPermissions, addParticipantChange.permissions)
    }

    @Test
    fun `should deploy the vault with the corresponding configuration`() = runTest {
        val kredentials = sdk.createKeypair()
        val vaultConfigBuilder = sdk.vaultConfigBuilder(kredentials.getAddress())
        // TODO: more advanced configurations! :-)
        val deployedVault = vaultConfigBuilder.deployVault()

        val allVaults = sdk.listAllVaults()
        assertEquals(1, allVaults.size)
        assertEquals(allVaults[0].vaultState.id, deployedVault.vaultState.id)

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
        reset(storage) // ignore method calls on a spy storage before the interesting part of the test
        // First, create a local change request to add a participant
        val participantAddress = anyAddress
        val permissions = VaultPermissions.ADMIN_PERMISSIONS
        val addedChange = deployedVault.addParticipant(participantAddress, permissions)
        assertEquals(
                LocalChangeType.ADD_PARTICIPANT,
                addedChange.changeType,
                "does not return the correct change object")
        val localState = deployedVault.getVaultLocalState()
        // Check that the correct vault state was passed the storage
        verify(storage, times(1)).putVaultState(localState)
        var changes = localState.localChanges
        assertEquals(1, changes.size, "local state does not contain the change")

        val expectedChange = changes[0] as AddParticipantChange
        assertEquals(LocalChangeType.ADD_PARTICIPANT, expectedChange.changeType)
        assertEquals(participantAddress, expectedChange.participant)

        // Configure the mocks to return the expected values
        val dueTime = "200"

        whenever(
                interactor.getConfigPendingEvent(anyString())
        ).thenReturn(
                configPendingEventResponse
        )
        whenever(
                interactor.getPendingChangeDueTime(any())
        ).thenReturn(dueTime)
        // Check that SDK returns expected data correctly
        val pendingChange = deployedVault.commitLocalChanges(anyStateId)
        assertEquals("0x_scheduled_tx_hash", pendingChange.transaction.hash)
        assertEquals(dueTime, pendingChange.dueTime)
        assertEquals(anyStateId, pendingChange.event.stateId)

        changes = deployedVault.getVaultLocalState().localChanges
        assertEquals(0, changes.size, "committing local changes does not clean up the state")
    }

    @Ignore
    @Test
    fun `should refuse to apply a change that is not yet due`() {

    }

    @Ignore
    @Test
    fun `should apply a change that is due`() {
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
        val destination = anyAddress
        val localChange = deployedVault.transferEth(amountToTransfer, destination)
        assertEquals(LocalChangeType.TRANSFER_ETH, localChange.changeType)

        val change = deployedVault.getVaultLocalState().localChanges[0] as EtherTransferChange
        assertEquals(amountToTransfer, change.amount)
        assertEquals(destination, change.destination)
        assertEquals(ETH_TOKEN_ADDRESS, change.token)

        val dueTime = "200"
        whenever(interactor.sendEther(anyString(), anyString(), anyString(), anyString())).thenReturn("0xether_transfer_hash")
        whenever(interactor.getConfigPendingEvent(anyString())).thenReturn(configPendingEventResponse)
        whenever(interactor.getPendingChangeDueTime(any())).thenReturn(dueTime)

        val pendingChanges = deployedVault.commitLocalTransfers(anyStateId)
        assertEquals(1, pendingChanges.size)
        val pendingChange = pendingChanges[0]
        val expectedHashStr = transactionChangeHash.toHexString()
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
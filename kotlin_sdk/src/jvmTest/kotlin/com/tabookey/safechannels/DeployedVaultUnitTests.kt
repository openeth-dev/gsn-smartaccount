package com.tabookey.safechannels

import com.nhaarman.mockitokotlin2.reset
import com.nhaarman.mockitokotlin2.times
import com.nhaarman.mockitokotlin2.verify
import com.nhaarman.mockitokotlin2.whenever
import com.tabookey.duplicated.VaultPermissions
import com.tabookey.safechannels.extensions.toHexString
import com.tabookey.safechannels.vault.DeployedVault
import com.tabookey.safechannels.vault.localchanges.AddParticipantChange
import com.tabookey.safechannels.vault.localchanges.ETH_TOKEN_ADDRESS
import com.tabookey.safechannels.vault.localchanges.EtherTransferChange
import com.tabookey.safechannels.vault.localchanges.LocalChangeType
import kotlinx.coroutines.runBlocking
import org.junit.Ignore
import org.mockito.ArgumentMatchers
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFails

class DeployedVaultUnitTests : SafeChannelsUnitTests() {

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
        val addedChange = deployedVault.addParticipant(env.anyAddress, VaultPermissions.ADMIN_PERMISSIONS)
        assertEquals(
                LocalChangeType.ADD_PARTICIPANT,
                addedChange.changeType,
                "does not return the correct change object")
        val localState = deployedVault.getVaultLocalState()

        // Check that the correct vault state was passed the storage
        verify(env.storage, times(1)).putVaultState(localState)

        var changes = localState.localChanges
        assertEquals(1, changes.size, "local state does not contain the change")

        val expectedChange = changes[0] as AddParticipantChange
        assertEquals(LocalChangeType.ADD_PARTICIPANT, expectedChange.changeType)
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
        vault.addParticipant(env.anyAddress, VaultPermissions.ADMIN_PERMISSIONS)
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
        vault.addParticipant(env.anyAddress, VaultPermissions.ADMIN_PERMISSIONS)
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
        whenever(env.interactor.sendEther(ArgumentMatchers.anyString(), ArgumentMatchers.anyString(), ArgumentMatchers.anyString(), ArgumentMatchers.anyString())).thenReturn("0xether_transfer_hash")
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
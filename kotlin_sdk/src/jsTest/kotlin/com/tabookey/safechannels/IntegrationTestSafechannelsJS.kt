package com.tabookey.safechannels

import com.tabookey.duplicated.EthereumAddress
import com.tabookey.duplicated.IKredentials
import com.tabookey.safechannels.addressbook.SafechannelContact
import com.tabookey.safechannels.platforms.InteractorsFactory
import com.tabookey.safechannels.vault.VaultState
import com.tabookey.safechannels.vault.VaultStorageInterface
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/**
 * Unit testing was much easier in JVM/Junit environment for me, so I propose we keep that there.
 * This tests use non-mocked interactor and run in a Node environment.
 */
class IntegrationTestSafechannelsJS {

    companion object {
        init {
            js("var VaultFactoryContractInteractor = require(\"js_foundation/src/js/VaultFactoryContractInteractorPromises\");")
        }

        const val ACCOUNT_ZERO = "0x90f8bf6a479f320ead074411a4b0e7944ea8c9c1"
    }

    var ethNodeUrl = "http://localhost:8545"
    val interactorsFactory = InteractorsFactory(ethNodeUrl, 1)

    suspend fun networkId(): Int {
        return 1
    }

    val kreds = object : IKredentials {
        override fun getAddress(): EthereumAddress {
            return ACCOUNT_ZERO
        }
    }

    @Test
    fun testHello() {
        assertTrue(true)
    }

    val storage = object : VaultStorageInterface {
        override fun getAllOwnedAccounts(): List<IKredentials> {
            return listOf(kreds)
        }

        override fun generateKeypair(): IKredentials {
            return kreds
        }

        override fun sign(transactionHash: String, address: String): String {
            TODO("not implemented") //To change body of created functions use File | Settings | File Templates.
        }

        override fun putVaultState(vault: VaultState): Int {
            return 0
        }

        override fun putAddressBookEntry(contact: SafechannelContact) {
            TODO("not implemented") //To change body of created functions use File | Settings | File Templates.
        }

        override fun getAllVaultsStates(): List<VaultState> {
            TODO("not implemented") //To change body of created functions use File | Settings | File Templates.
        }

        override fun getAddressBookEntries(): List<SafechannelContact> {
            TODO("not implemented") //To change body of created functions use File | Settings | File Templates.
        }

        override fun getStuff() {
            TODO("not implemented") //To change body of created functions use File | Settings | File Templates.
        }

        override fun putStuff() {
            TODO("not implemented") //To change body of created functions use File | Settings | File Templates.
        }

    }

    /**
     * This is not as much a test as a 'beforeAll' part here, because the SDK (I believe) should not have a
     * factory deployment API. So this 'test' belongs to the js-foundation tests.
     * Here, what is needed to construct an SDK instance is a newly deployed gatekeeper address.
     */
    @Test
    fun should_deploy_new_vault_via_factory_interactor() = runTest {
        val vaultFactoryAddress = interactorsFactory.deployNewVaultFactory(kreds.getAddress())
        val vaultFactoryContractInteractor = interactorsFactory.interactorForVaultFactory(kreds, vaultFactoryAddress)
        val newGatekeeper = vaultFactoryContractInteractor.deployNewGatekeeper()
        assertEquals(ACCOUNT_ZERO, newGatekeeper.sender.toLowerCase())
        assertEquals(42, newGatekeeper.gatekeeper.length)
        assertEquals(42, newGatekeeper.vault.length)
    }

    /**
     * Normally, the SDK will be called from within the pure JavaScript and therefore there is no need to have
     * a Kotlin version of the 'require' statements;
     * The problem with these tests is that they are run directly by Gradle/Mocha,
     * and Kotlin does not generate the 'require's.
     * The 'js' method will inject whatever you put in there directly to the corresponding generated JavaScript code.
     */
    @Test
    fun should_construct_sdk_and_keypair_correctly() = runTest {
        val sdk = newSafeChannels()
        val keypair = sdk.createKeypair()
        assertEquals(42, keypair.getAddress().length)
    }

    private suspend fun newSafeChannels(): SafeChannels {
        val vaultFactoryAddress = interactorsFactory.deployNewVaultFactory(kreds.getAddress())
        val vaultFactoryContractInteractor = interactorsFactory.interactorForVaultFactory(kreds, vaultFactoryAddress)
        return SafeChannels(interactorsFactory, vaultFactoryContractInteractor, storage)
    }

    @Test
    fun should_schedule_add_participant() = runTest {
        val sdk = newSafeChannels()
        val vault = sdk.createLocalVault(kreds.getAddress()).deployVault()
        assertEquals(42, vault.vaultState.address!!.length)
        assertEquals(42, vault.vaultState.gatekeeperAddress!!.length)
    }

}
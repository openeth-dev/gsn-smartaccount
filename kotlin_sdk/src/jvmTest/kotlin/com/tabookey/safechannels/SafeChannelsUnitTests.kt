package com.tabookey.safechannels

import org.junit.Before

open class SafeChannelsUnitTests {
    lateinit var env: SDKEnvironmentMock
    lateinit var sdk: SafeChannels

    @Before
    fun before() {
        env = SDKEnvironmentMock()
        sdk = SafeChannels(env.interactorsFactory, env.storage)
    }
}
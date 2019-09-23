package com.tabookey.safechannels.platforms

expect class Response{
    val sender: String

    val gatekeeper: String

    val vault: String
}
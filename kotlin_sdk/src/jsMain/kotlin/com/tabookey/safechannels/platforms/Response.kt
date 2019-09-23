package com.tabookey.safechannels.platforms

actual external class Response {
    actual val sender: String
    actual val gatekeeper: String
    actual val vault: String
}
package com.tabookey.safechannels.platforms

expect class Response{
    var sender: String?

    var gatekeeper: String?

    var vault: String?
}
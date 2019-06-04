package com.tabookey.untitled;


import com.tabookey.java_foundation.App;
import com.tabookey.kotlin_sdk.Sdk;
import sample.SampleKt;

public class Main {
    public static void main(String[] args) {
        System.out.println(SampleKt.hello());
        App app = new App();
        new Sdk(app).doStuff();
    }
}

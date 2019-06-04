package com.tabookey.java_foundation;


import com.tabookey.kotlin_sdk.IApp;
import com.tabookey.kotlin_sdk.Receipt;

public class App implements IApp {
    @Override
    public Receipt emitMessageWrapped(String message, int value) {
        return null;
    }

    @Override
    public Object getData() {
        return null;
    }

    @Override
    public void foo(int value) {

    }
}
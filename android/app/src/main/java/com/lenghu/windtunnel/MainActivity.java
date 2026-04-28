package com.lenghu.windtunnel;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        registerPlugin(SystemInsetsPlugin.class);
        super.onCreate(savedInstanceState);
    }
}

package com.lenghu.windtunnel;

import android.view.View;

import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.PluginMethod;

@CapacitorPlugin(name = "SystemInsets")
public class SystemInsetsPlugin extends Plugin {

    @PluginMethod
    public void getInsets(PluginCall call) {
        int top = 0;
        int bottom = 0;
        int left = 0;
        int right = 0;

        try {
            View root = getActivity().getWindow().getDecorView();
            WindowInsetsCompat insets = ViewCompat.getRootWindowInsets(root);
            if (insets != null) {
                Insets bars = insets.getInsets(
                        WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout()
                );
                top = bars.top;
                bottom = bars.bottom;
                left = bars.left;
                right = bars.right;
            }
        } catch (Exception ignored) {
            // Return zeros on failure.
        }

        JSObject ret = new JSObject();
        ret.put("top", top);
        ret.put("bottom", bottom);
        ret.put("left", left);
        ret.put("right", right);
        call.resolve(ret);
    }
}


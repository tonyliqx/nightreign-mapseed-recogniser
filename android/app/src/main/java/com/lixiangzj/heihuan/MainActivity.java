package com.lixiangzj.heihuan;

import android.graphics.Color;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // 系统栏与 WebView 背景统一深色（#1a1a2e，与页面主题一致）：
        // 页面加载前与 edge-to-edge 导航栏区域不再露出默认白色
        getWindow().setNavigationBarColor(Color.parseColor("#1a1a2e"));
        getWindow().setStatusBarColor(Color.parseColor("#1a1a2e"));
        if (this.bridge != null && this.bridge.getWebView() != null) {
            this.bridge.getWebView().setBackgroundColor(Color.parseColor("#1a1a2e"));
        }
    }
}

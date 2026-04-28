import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.lenghu.windtunnel',
  appName: '冷湖智能风洞测试系统',
  webDir: 'dist',
  server: {
    cleartext: true,
    androidScheme: 'http'
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: false,
      androidScaleType: 'CENTER_CROP',
      backgroundColor: '#000000',
      splashFullScreen: true,
      splashImmersive: true
    }
  }
};

export default config;

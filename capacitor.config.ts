import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.aplexmovies.app',
  appName: 'APLEX Movies',
  webDir: 'www',
  backgroundColor: '#090A0F',
  loggingBehavior: 'none',
  android: {
    backgroundColor: '#090A0F',
    allowMixedContent: false,
    zoomEnabled: false,
    webContentsDebuggingEnabled: false
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 450,
      backgroundColor: '#090A0F',
      showSpinner: false
    }
  }
};

export default config;


import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.openstars.emulator',
  appName: 'OpenSTARS',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
  ios: {
    contentInset: 'always'
  },
  plugins: {
    StatusBar: {
      style: 'DARK',
      overlay: true, // Make the status bar float over content (or hide if combined with fullscreen methods)
    }
  }
};

export default config;

import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.enludus.app',
  appName: 'My Language Dojo',
  webDir: 'out',
  plugins: {
    CapacitorHttp: {
      enabled: true,
    },
  },
};

export default config;

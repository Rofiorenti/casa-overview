import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.fiorentini.casaoverview',
  appName: 'Casa Overview',
  webDir: 'dist',
  backgroundColor: '#f5f1ea',
  ios: {
    contentInset: 'always',
    scheme: 'CasaOverview',
  },
  plugins: {
    // CapacitorHttp usa URLSession nativa (bypassa il WebView) per fetch.
    // Utile per domini che hanno CORS restrittivi come storage.googleapis.com.
    CapacitorHttp: {
      enabled: true,
    },
  },
};

export default config;

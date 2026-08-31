export default {
  expo: {
    name: 'FitnessMacro',
    slug: 'fitness-macro',
    version: '0.3.0',
    orientation: 'portrait',
    jsEngine: 'hermes',
    updates: {
      enabled: true,
      checkAutomatically: 'ON_LOAD'
    },
    runtimeVersion: {
      policy: 'sdkVersion'
    },
    extra: {
      eas: {
        projectId: '714cf37d-459a-4408-b025-1334f0bfc779'
      }
    },
    plugins: [
      'react-native-health-connect',
      [
        'expo-navigation-bar',
        {
          hidden: true,
          style: 'dark',
          enforceContrast: false
        }
      ],
      [
        'expo-image-picker',
        {
          photosPermission: 'Allow FitnessMacro to use a profile photo saved on this device.'
        }
      ],
      'expo-secure-store',
      [
        'expo-build-properties',
        {
          android: {
            compileSdkVersion: 36,
            targetSdkVersion: 36,
            minSdkVersion: 26,
            usesCleartextTraffic: false
          }
        }
      ],
      [
        'expo-audio',
        {
          microphonePermission: 'Allow FitnessMacro to record food descriptions for private transcription.'
        }
      ],
      [
        'expo-camera',
        {
          cameraPermission: 'Allow FitnessMacro to scan food barcodes.',
          recordAudioAndroid: false,
          barcodeScannerEnabled: true
        }
      ]
    ],
    ios: {
      supportsTablet: true
    },
    android: {
      package: 'com.ashar.fitnessmacro',
      // These are declared in the Android manifest so the Health Connect
      // permission screen can appear in a standalone APK. The app requests
      // only these three read scopes at runtime.
      permissions: [
        'android.permission.health.READ_WEIGHT',
        'android.permission.health.READ_ACTIVE_CALORIES_BURNED',
        'android.permission.health.READ_TOTAL_CALORIES_BURNED'
      ]
    }
  }
};

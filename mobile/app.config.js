export default {
  expo: {
    name: 'Weed Fitness',
    icon: './assets/weed-fitness-icon.png',
    slug: 'fitness-macro',
    version: '0.3.0', // x-release-please-version
    orientation: 'portrait',
    jsEngine: 'hermes',
    updates: {
      enabled: true,
      url: 'https://u.expo.dev/714cf37d-459a-4408-b025-1334f0bfc779',
      checkAutomatically: 'ON_LOAD',
      fallbackToCacheTimeout: 0
    },
    // Native dependencies/config are unchanged from APK 0.2.2. Keep this ABI
    // explicit so versioned JavaScript fixes reach the installed preview APK.
    // Any future native dependency/permission/plugin change MUST bump it.
    runtimeVersion: '0.2.2',
    extra: {
      eas: {
        projectId: '714cf37d-459a-4408-b025-1334f0bfc779'
      }
    },
    plugins: [
      'expo-font',
      'expo-asset',
      [
        'expo-splash-screen',
        {
          image: './assets/weed-fitness-icon.png',
          imageWidth: 190,
          resizeMode: 'contain',
          backgroundColor: '#F7F1E7',
          dark: {
            image: './assets/weed-fitness-icon.png',
            backgroundColor: '#F7F1E7'
          }
        }
      ],
      'react-native-health-connect',
      [
        'expo-navigation-bar',
        {
          hidden: false,
          style: 'dark',
          enforceContrast: false
        }
      ],
      [
        'expo-image-picker',
        {
          photosPermission: 'Allow Weed Fitness to use profile, recipe, and food photos saved on this device.'
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
          microphonePermission: 'Allow Weed Fitness to record food descriptions for private transcription.'
        }
      ],
      [
        'expo-camera',
        {
          cameraPermission: 'Allow Weed Fitness to scan food barcodes.',
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
      adaptiveIcon: {
        foregroundImage: './assets/weed-fitness-icon.png',
        backgroundColor: '#0B3D2E'
      },
      softwareKeyboardLayoutMode: 'resize',
      // These are declared in the Android manifest so the Health Connect
      // permission screen can appear in a standalone APK. The app requests
      // only these read scopes at runtime.
      permissions: [
        'android.permission.health.READ_WEIGHT',
        'android.permission.health.READ_EXERCISE',
        'android.permission.health.READ_ACTIVE_CALORIES_BURNED',
        'android.permission.health.READ_DISTANCE'
      ]
    }
  }
};

import { registerRootComponent } from 'expo';
import * as SplashScreen from 'expo-splash-screen';
import App from './App';

// Keep Android's native launch surface in place until React has drawn the
// branded in-app loader. This prevents the default white/generic-icon flash.
void SplashScreen.preventAutoHideAsync();
SplashScreen.setOptions({ duration: 220, fade: true });

registerRootComponent(App);

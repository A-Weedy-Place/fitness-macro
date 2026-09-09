import { useEffect, useRef } from 'react';
import { BackHandler, Keyboard, Platform } from 'react-native';
import { createBackStack } from '../logic/backStack';

const stack = createBackStack();
let users = 0;
let subscription: ReturnType<typeof BackHandler.addEventListener> | undefined;

export function dismissKeyboardFirst(): boolean {
  if (!Keyboard.isVisible()) return false;
  Keyboard.dismiss();
  return true;
}

/** Native Modals use onRequestClose; inline screens share this priority stack. */
export function useAndroidBack(handle: () => boolean, priority = 10) {
  const current = useRef(handle);
  current.current = handle;
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const remove = stack.add(priority, () => current.current());
    if (users++ === 0) subscription = BackHandler.addEventListener('hardwareBackPress', () => dismissKeyboardFirst() || stack.back());
    return () => {
      remove();
      if (--users === 0) { subscription?.remove(); subscription = undefined; }
    };
  }, [priority]);
}

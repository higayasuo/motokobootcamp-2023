import { Platform } from 'react-native';

// This function only checks Chrome and Safari on macOS,
// as it's intended for local testing of Expo apps
export const isLocalhostSubdomainSupported = (): boolean => {
  // Return false for mobile platforms
  if (Platform.OS === 'ios' || Platform.OS === 'android') {
    return false;
  }

  if (!window?.location?.origin?.includes('localhost')) {
    return false;
  }

  const userAgent = window?.navigator?.userAgent?.toLowerCase() || '';

  // Chrome has built-in support for localhost subdomains
  if (userAgent.includes('chrome')) {
    return true;
  }

  // Safari and other browsers are not supported
  return false;
};

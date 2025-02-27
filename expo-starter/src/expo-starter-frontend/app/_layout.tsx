import FontAwesome from '@expo/vector-icons/FontAwesome';
import { ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState, useRef, useCallback } from 'react';
import 'react-native-reanimated';
import { useAuth } from '@/hooks/useAuth';
import { AuthProvider } from '@/contexts/AuthContext';
import {
  View,
  ActivityIndicator,
  Text,
  StyleSheet,
  Pressable,
} from 'react-native';

import { createBackend } from '@/icp/backend';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: '(tabs)',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    ...FontAwesome.font,
  });

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  const auth = useAuth();
  const {
    isReady,
    identity,
    decryptExistingAesKey,
    generateAesKey,
    generateAndEncryptAesKey,
    clearAesRawKey,
    getTransportPublicKey,
  } = auth;
  const [initializationStatus, setInitializationStatus] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const initializationCompleted = useRef(false);
  const initializationAttempted = useRef(false);

  // Initialize AES key function
  const initAesKey = useCallback(async () => {
    // Don't run if already loading
    if (isLoading) return;

    try {
      setError(null);
      setIsLoading(true);
      initializationAttempted.current = true;

      if (!identity) {
        console.log('No identity found, generating new AES key');
        setInitializationStatus('Generating new AES key...');
        await generateAesKey();
        setInitializationStatus('AES key generated');
        initializationCompleted.current = true;
        return;
      }

      clearAesRawKey();
      setInitializationStatus('Fetching keys from backend...');

      const backend = createBackend(identity);
      const transportPublicKey = getTransportPublicKey();

      const keysReply = await backend.asymmetric_keys(transportPublicKey);
      const publicKey = keysReply.public_key as Uint8Array;
      const encryptedAesKey = keysReply.encrypted_aes_key?.[0] as
        | Uint8Array
        | undefined;
      const encryptedKey = keysReply.encrypted_key?.[0] as
        | Uint8Array
        | undefined;
      const principal = identity.getPrincipal();

      if (encryptedAesKey && encryptedKey) {
        console.log('Decrypting existing AES key');
        setInitializationStatus('Decrypting existing AES key...');
        await decryptExistingAesKey(
          encryptedAesKey,
          encryptedKey,
          publicKey,
          principal,
        );
      } else {
        console.log('Generating and encrypting new AES key');
        setInitializationStatus('Generating and encrypting new AES key...');
        const newEncryptedAesKey = await generateAndEncryptAesKey(
          publicKey,
          principal,
        );
        console.log('Saving new encrypted AES key');
        setInitializationStatus('Saving encrypted AES key...');
        await backend.asymmetric_save_encrypted_aes_key(newEncryptedAesKey);
      }

      setInitializationStatus('AES key initialization completed');
      initializationCompleted.current = true;
    } catch (err) {
      console.error('Failed to initialize AES key:', err);
      setInitializationStatus(`Failed to initialize AES key: ${err}`);
      setError(err instanceof Error ? err : new Error(String(err)));
      // We don't reset initializationCompleted here, as we'll use the retry button instead
    } finally {
      setIsLoading(false);
    }
  }, [
    identity,
    isLoading,
    generateAesKey,
    clearAesRawKey,
    getTransportPublicKey,
    decryptExistingAesKey,
    generateAndEncryptAesKey,
  ]);

  // Auto-initialize on first load
  useEffect(() => {
    if (!isReady || initializationAttempted.current) {
      return;
    }

    initAesKey();
  }, [isReady, initAesKey]);

  // Handle retry
  const handleRetry = () => {
    initAesKey();
  };

  // Handle continue with local key
  const handleContinueWithLocalKey = async () => {
    setError(null);
    setInitializationStatus('Generating local AES key...');
    setIsLoading(true);

    try {
      await generateAesKey();
      setInitializationStatus('Local AES key generated');
      initializationCompleted.current = true;
    } catch (err) {
      console.error('Failed to generate local AES key:', err);
      setInitializationStatus(`Failed to generate local AES key: ${err}`);
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  };

  if (!isReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.contentContainer}>
          <ActivityIndicator
            size="large"
            color="#007AFF"
            style={styles.indicator}
          />
          <Text style={styles.loadingText}>Preparing Encryption</Text>
          <Text style={styles.statusText}>{initializationStatus}</Text>
          <Text style={styles.hintText}>This may take a moment...</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.contentContainer}>
          <Text style={styles.errorTitle}>Initialization Error</Text>
          <Text style={styles.errorText}>{error.message}</Text>
          <Text style={styles.statusText}>{initializationStatus}</Text>

          <View style={styles.buttonContainer}>
            <Pressable style={styles.retryButton} onPress={handleRetry}>
              <Text style={styles.buttonText}>Retry</Text>
            </Pressable>

            <Pressable
              style={styles.localKeyButton}
              onPress={handleContinueWithLocalKey}
            >
              <Text style={styles.buttonText}>Continue with Local Key</Text>
            </Pressable>
          </View>

          <Text style={styles.hintText}>
            You can retry connecting to the backend or continue with a local
            encryption key. A local key will work for this session but won't be
            synchronized with your account.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <AuthProvider value={auth}>
      <ThemeProvider
        value={{
          dark: false,
          colors: {
            primary: '#007AFF',
            background: '#fff',
            card: '#fff',
            text: '#000',
            border: '#ccc',
            notification: '#ff3b30',
          },
          fonts: {
            regular: {
              fontFamily: 'System',
              fontWeight: '400',
            },
            medium: {
              fontFamily: 'System',
              fontWeight: '500',
            },
            bold: {
              fontFamily: 'System',
              fontWeight: '700',
            },
            heavy: {
              fontFamily: 'System',
              fontWeight: '900',
            },
          },
        }}
      >
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        </Stack>
      </ThemeProvider>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 20,
  },
  contentContainer: {
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    marginTop: -80,
  },
  indicator: {
    marginBottom: 24,
  },
  loadingText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  statusText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    textAlign: 'center',
  },
  hintText: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 16,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ff3b30',
    marginBottom: 12,
  },
  errorText: {
    fontSize: 16,
    color: '#ff3b30',
    marginBottom: 16,
    textAlign: 'center',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 16,
    gap: 12,
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  localKeyButton: {
    backgroundColor: '#34C759',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
});

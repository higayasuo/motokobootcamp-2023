import React from 'react';
import { View, Text, Pressable } from 'react-native';
import {
  baseTextStyles,
  containerStyles,
  subheaderStyles,
  headerStyles,
  buttonStyles,
  disabledButtonStyles,
  buttonTextStyles,
} from './styles';

interface LoggedOutProps {
  onLogin: () => Promise<void>;
}

export default function LoggedOut({ onLogin }: LoggedOutProps) {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | undefined>();

  function handlePress() {
    setBusy(true);
    setError(undefined); // Clear previous error
    onLogin()
      .catch((error) => {
        setError('Error occurred during login: ' + error.message);
      })
      .finally(() => {
        setBusy(false);
      });
  }

  return (
    <View id="container" style={containerStyles}>
      <Text style={headerStyles}>Internet Identity Client</Text>
      <Text style={subheaderStyles}>You are not authenticated</Text>
      <Text style={baseTextStyles}>To log in, click this button</Text>
      <Pressable
        style={busy ? disabledButtonStyles : buttonStyles}
        accessibilityRole="button"
        disabled={busy}
        accessibilityState={{ busy }}
        onPress={handlePress}
      >
        <Text style={buttonTextStyles}>Log in</Text>
      </Pressable>
      {error && <Text style={{ color: 'red' }}>{error}</Text>}
      <Text style={baseTextStyles}>You are not authenticated</Text>
    </View>
  );
}

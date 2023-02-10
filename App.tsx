import {StripeTerminalProvider} from '@stripe/stripe-terminal-react-native';
import TerminalAppWrapper from './src/TerminalAppWrapper';
import React from 'react';

export default function App() {
  const fetchTokenProvider = async () => {
    const response = await fetch(
      'https://goodbricksapp.com/api/stripe/connection_token?organizationPublicId=icsd.org',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );
    const {secret} = await response.json();
    console.log('### Fetching token ###', secret);
    return secret;
  };
  // 'none' | 'verbose' | 'error' | 'warning';
  return (
    <StripeTerminalProvider logLevel="none" tokenProvider={fetchTokenProvider}>
      <TerminalAppWrapper />
    </StripeTerminalProvider>
  );
}

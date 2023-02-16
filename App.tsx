import {StripeTerminalProvider} from '@stripe/stripe-terminal-react-native';
import TerminalAppWrapper from './src/TerminalAppWrapper';
import React, {useState} from 'react';

export default function App() {
  const [organizationPublicId, setOrganizationPublicId] = useState();
  const [locationId, setLocationId] = useState('');

  const fetchTokenProvider = async () => {
    const response = await fetch(
      `https://goodbricksapp.com/api/stripe/connection_token_location?organizationPublicId=${organizationPublicId}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );
    const {locationId, secret} = await response.json();
    console.log('### Fetching token ###', secret);
    setLocationId(locationId);
    return secret;
  };

  const updateOrganizationPublicId = organizationPublicId => {
    setOrganizationPublicId(organizationPublicId);
  };

  // 'none' | 'verbose' | 'error' | 'warning';
  return (
    <StripeTerminalProvider logLevel="none" tokenProvider={fetchTokenProvider}>
      <TerminalAppWrapper
        onUpdateOrganizationPublicId={updateOrganizationPublicId}
        locationId={locationId}
      />
    </StripeTerminalProvider>
  );
}

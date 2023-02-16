import {StripeTerminalProvider} from '@stripe/stripe-terminal-react-native';
import TerminalAppWrapper from './src/TerminalAppWrapper';
import React, {useState} from 'react';
import {getDeviceId, isLocationEnabled} from 'react-native-device-info';
// import {check, PERMISSIONS, request, RESULTS} from 'react-native-permissions';

export default async function App() {
  const [organizationPublicId, setOrganizationPublicId] = useState();
  const [locationId, setLocationId] = useState('');

  isLocationEnabled().then(enabled => {
    console.log(
      '### Device Info | Location Enabled ###',
      getDeviceId(),
      enabled,
    );
  });

  // switch (await check(PERMISSIONS.IOS.BLUETOOTH_PERIPHERAL)) {
  //   case RESULTS.UNAVAILABLE:
  //     console.log(
  //       'This feature is not available (on this device / in this context)',
  //     );
  //     break;
  //   case RESULTS.DENIED:
  //     const res2 = await request(PERMISSIONS.IOS.BLUETOOTH_PERIPHERAL);
  //     console.log(
  //       'This feature is not available (on this device / in this context)',
  //     );
  //     break;
  //
  //   case RESULTS.GRANTED:
  //     console.log('This bluetooth is already enabled');
  //     break;
  //   case RESULTS.BLOCKED:
  //     console.log('This bluetooth is blocked on this device');
  //     break;
  // }

  // NetInfo.fetch().then(state => {
  //   console.log('Connection type', state.type);
  //   console.log('Is connected?', state.isConnected);
  // });

  // useEffect(() => {
  //   const unsubscribe = NetInfo.addEventListener(state => {
  //     console.log('Connection type', state.type);
  //     console.log('Is connected?', state.isConnected);
  //   });
  //   return () => {
  //     // Clean up the subscription
  //     unsubscribe();
  //   };
  // }, []);

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

  // useEffect(() => {
  //   initialize().then(r => setInitialized(true));
  // }, [initialize]);

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

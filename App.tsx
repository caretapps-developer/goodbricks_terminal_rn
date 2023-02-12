import {StripeTerminalProvider} from '@stripe/stripe-terminal-react-native';
import TerminalAppWrapper from './src/TerminalAppWrapper';
import React, {useState} from 'react';

export default function App() {
  const [organizationPublicId, setOrganizationPublicId] = useState();
  const [fetchedToken, setFetchedToken] = useState("not_fetched");
  const fetchTokenProvider = async () => {
    const response = await fetch(
      `https://goodbricksapp.com/api/stripe/connection_token?organizationPublicId=${organizationPublicId}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );
    const {secret} = await response.json();
    console.log('### Fetching token ###', secret);
    setFetchedToken('fetched');
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
      <TerminalAppWrapper onUpdateOrganizationPublicId={updateOrganizationPublicId} fetchedToken={fetchedToken}/>
    </StripeTerminalProvider>
  );
}

import {useEffect, useRef, useState} from 'react';
import {useStripeTerminal} from '@stripe/stripe-terminal-react-native';
import TemrinalApp from './TemrinalApp';

export default function TerminalAppWrapper(props) {
  const {initialize} = useStripeTerminal();
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    initialize().then(r => setInitialized(true));
  }, [initialize]);

  return initialized && <TemrinalApp onUpdateOrganizationPublicId={props.onUpdateOrganizationPublicId} locationId={props.locationId}/>;
}

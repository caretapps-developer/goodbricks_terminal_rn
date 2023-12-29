import {WebView} from 'react-native-webview';
import {useRef, useState} from 'react';
import {useStripeTerminal} from '@stripe/stripe-terminal-react-native';
import {
  collectPaymentMethod,
  connectBluetoothReader,
  createPaymentIntent,
  disconnectReader,
} from '@stripe/stripe-terminal-react-native/src/functions';

export default function TemrinalApp(props) {
  const webViewRef = useRef(null);
  const [connectedReaderOrganization, setConnectedReaderOrganization] = useState();
  const [connectedReader, setConnectedReader] = useState();
  const [lockedTo, setLockedTo] = useState();
  const {discoverReaders, discoveredReaders, readReusableCard, cancelCollectPaymentMethod, processPayment} =
    useStripeTerminal({
      onUpdateDiscoveredReaders: async readers => {
        console.log('### onUpdateDiscoveredReaders. ', readers.length);
        for (var i = 0; i < readers.length; i++) {
          if (readers[i] && lockedTo && lockedTo !== readers[i].serialNumber.slice(-5)) {
            console.log('### Discovered reader: ' + readers[i].serialNumber + '. But device locked to: ', lockedTo);
            postWebMessage(
              'goodbricks.readerDisplayUpdated',
              `Discovered reader ${readers[i].serialNumber}, but device locked to ...${lockedTo}`,
            );
          } else {
            postWebMessage('goodbricks.readerDisplayUpdated', `Reader discovered. ${readers[i].serialNumber}`);
            await doConnectReader(readers[i]);
            break;
          }
        }
      },
      onDidChangeConnectionStatus: status => {
        // access to the current connection status
        console.log('### Reader status. ', status);
        postWebMessage('goodbricks.readerDisplayUpdated', `Reader ${status}`);
      },
      // When a transaction begins, the SDK passes a ReaderInputOptions value to your app’s reader display handler, denoting the acceptable types of input (for example, Swipe, Insert, Tap). In your app’s checkout UI, prompt the user to present a card using one of these options.
      // During the transaction, the SDK might request your app to display additional prompts (for example, Retry Card) to your user by passing a ReaderDisplayMessage value to your app’s reader display handler. Make sure your checkout UI displays these messages to the user.
      onDidRequestReaderInput(inputOptions) {
        postWebMessage('goodbricks.showCardInputOptions', inputOptions.join('/'));
      },
    });

  const doConnectReader = async (reader, simulated = false) => {
    if (lockedTo && lockedTo !== reader.serialNumber.slice(-5)) {
      console.log('### Reader locked to: ', lockedTo);
      postWebMessage(
        'goodbricks.readerDisplayUpdated',
        'Unable to connect: ' + reader.serialNumber + ' Device is locked to reader: ' + lockedTo,
      );
      return;
    }
    console.log('### Connecting reader to : ', connectedReaderOrganization);
    const {reader: connectedReader, error} = await connectBluetoothReader({
      reader,
      locationId: props.locationId,
    });
    setConnectedReader(connectedReader);
    if (error) {
      if (error.code === 'AlreadyConnectedToReader') {
        console.log('### Reader already connected data: ', reader.serialNumber);
        postWebMessage('goodbricks.updateReaderInfo', reader);
      } else if (error.code === 'MustBeDiscoveringToConnect') {
        console.log('### Calling discover readers again... ');
        const {error} = await discoverReaders({
          discoveryMethod: 'bluetoothScan',
          simulated: simulated,
        });
        if (error) {
          const {code, message} = error;
          console.warn(`### Discover readers error. ${code}: ${message}`);
        }
      } else {
        const {code, message} = error;
        console.warn(`### Connect BluetoothReader error. ${code}: ${message}`);
      }
    } else {
      console.log('### Reader connected: ', connectedReader.serialNumber, connectedReaderOrganization);
      setConnectedReader(connectedReader);
      postWebMessage(
        'goodbricks.readerDisplayUpdated',
        `Reader discovered and connected. ${connectedReader.serialNumber}`,
      );
      postWebMessage('goodbricks.readerConnected', connectedReader);
    }
  };

  const doDiscoverAndConnectReader = async (data, hardconnect = false) => {
    setLockedTo(data.deviceLockedTo);
    if (discoveredReaders.length !== 0 && !hardconnect) {
      for (var i = 0; i < discoveredReaders.length; i++) {
        if (lockedTo && lockedTo !== discoveredReaders[i].serialNumber.slice(-5)) {
          console.log(
            '### Unable to connect to ' + discoveredReaders[i].serialNumber + '. Reader locked to: ',
            lockedTo,
          );
        } else {
          console.log('### Connecting to previously discovered reader: ', discoveredReaders[i].serialNumber);
          await doConnectReader(discoveredReaders[i], data?.simulated);
          break;
        }
      }
    } else {
      console.log('### Discovering readers... ');
      const {error} = await discoverReaders({
        discoveryMethod: 'bluetoothScan',
        simulated: data.simulated,
      });
      if (error) {
        const {code, message} = error;
        console.warn(`### Discover readers error. ${code}: ${message}`);
      }
    }
  };

  const doCreatePaymentIntent = async eventData => {
    console.log('### Creating payment intent... ', eventData);
    await createPaymentIntent({
      amount: eventData.paymentIntent.amount * 100,
      currency: 'usd',
      paymentMethodTypes: ['card_present'],
    }).then(createPaymentIntent => {
      if (createPaymentIntent.paymentIntent.id) {
        console.log('### PaymentIntent created: ', createPaymentIntent);
        collectPaymentMethod({
          paymentIntentId: createPaymentIntent.paymentIntent.id,
        }).then(async collectPaymentIntent => {
          console.log(`### Collecting payment method for intent: ${createPaymentIntent}`);
          if (collectPaymentIntent.error) {
            console.warn(
              `### Collecting payment method error. ${collectPaymentIntent.error.code}: ${collectPaymentIntent.error.message}`,
            );
            postWebMessage('goodbricks.showProcessingError', collectPaymentIntent.error.message);
            return;
          }
          console.log('### Collected payment method. Now processing payment...');
          const {error, processPaymentIntent} = await processPayment(collectPaymentIntent.paymentIntent.id);
          if (error) {
            console.warn(`### Process payment method error. ${error.code}: ${error.message}`);
            postWebMessage('goodbricks.showProcessingError', error.message);
            return;
          }
          postWebMessage('goodbricks.paymentIntentCreated', collectPaymentIntent.paymentIntent.id);
        });
      }
    });
  };

  const doCancelPaymentIntent = async eventData => {
    console.log('### Canceling payment intent...');
    await cancelCollectPaymentMethod();
    postWebMessage('goodbricks.paymentIntentCancelled', 'Cancelled Payment intent');
    console.log('### Canceled payment intent...');
  };

  const doCreatePaymentMethod = async eventData => {
    console.log('### Saving payment method...');
    const {paymentMethod, error} = await readReusableCard({});
    if (error) {
      console.warn(`### Error saving payment method. ${error.code}: ${error.message}`);
      postWebMessage('goodbricks.showProcessingError', error.message);
      return;
    }
    postWebMessage('goodbricks.paymentMethodCreated', paymentMethod.id);
    postWebMessage('goodbricks.updateReaderStatus', 'Processing payment...');
    console.log('### Saved payment method: ', paymentMethod.id);
  };

  const doFetchConnectedReaderInfo = async eventData => {
    console.log('### Fetching reader info... ');
    postWebMessage('goodbricks.updateReaderInfo', connectedReader);
  };

  function postWebMessage(topic, message) {
    const responseJSON = {topic, message};
    const javascriptToInject = `
            webViewEventHandler(${JSON.stringify(responseJSON)})
            true;
    `;
    webViewRef.current.injectJavaScript(javascriptToInject);
  }

  const handleOnMessage = async event => {
    const {data} = event.nativeEvent;
    console.log('### Web message received', data);
    const eventData = JSON.parse(data);
    switch (eventData.event) {
      case 'initializeTerminalForOrganization':
        if (eventData.data.organizationPublicId === connectedReaderOrganization) {
          await doDiscoverAndConnectReader(eventData.data);
          break;
        }
        props.onUpdateOrganizationPublicId(eventData.data.organizationPublicId);
        if (connectedReader) {
          await disconnectReader();
          console.log('### Reader disconnected: ', connectedReader.serialNumber);
        }
        setConnectedReaderOrganization(eventData.data.organizationPublicId);
        // await sleep(3000);
        await doDiscoverAndConnectReader(eventData.data, true);
        break;
      case 'discoverAndConnectReader':
        await doDiscoverAndConnectReader(eventData.data);
        break;
      case 'createPaymentIntent':
        await doCreatePaymentIntent(eventData.data);
        break;
      case 'createPaymentMethod':
        await doCreatePaymentMethod(eventData.data);
        break;
      case 'cancelPaymentIntent':
        await doCancelPaymentIntent(eventData.data);
        break;
      case 'getConnectedReaderInfo':
        await doFetchConnectedReaderInfo(eventData.data);
        break;
      default:
        console.log('### Ignoring event...', eventData.data);
        break;
    }
  };

  const sleep = ms => new Promise(r => setTimeout(r, ms));

  return (
    <WebView
      ref={webViewRef}
      source={{uri: 'https://terminal.goodbricksapp.com'}}
      style={{marginTop: 50}}
      onMessage={handleOnMessage}
      javaScriptEnabled={true}
    />
  );
}

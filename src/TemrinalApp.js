import {StyleSheet} from 'react-native';
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
  const runFirst = `
      // document.body.style.backgroundColor = 'red';
      true; // note: this is required, or you'll sometimes get silent failures
    `;
  const [connectedReaderOrganization, setConnectedReaderOrganization] =
    useState();
  const {
    discoverReaders,
    discoveredReaders,
    readReusableCard,
    cancelCollectPaymentMethod,
    processPayment,
  } = useStripeTerminal({
    onUpdateDiscoveredReaders: async readers => {
      // access to discovered readers
      const reader = readers[0];
      console.log('### onUpdateDiscoveredReaders ###', reader);
      await doConnectReader(reader);
    },
    onDidChangeConnectionStatus: status => {
      // access to the current connection status
      console.log('### onDidChangeConnectionStatus ###', status);
    },
    // When a transaction begins, the SDK passes a ReaderInputOptions value to your app’s reader display handler, denoting the acceptable types of input (for example, Swipe, Insert, Tap). In your app’s checkout UI, prompt the user to present a card using one of these options.
    // During the transaction, the SDK might request your app to display additional prompts (for example, Retry Card) to your user by passing a ReaderDisplayMessage value to your app’s reader display handler. Make sure your checkout UI displays these messages to the user.
    onDidRequestReaderInput(inputOptions) {
      postWebMessage('goodbricks.showCardInputOptions', inputOptions.join('/'));
    },
  });

  const doConnectReader = async reader => {
    console.log(' #### Reader Location: ', connectedReaderOrganization);
    const {reader: connectedReader, error} = await connectBluetoothReader({
      reader,
      locationId: props.locationId,
    });
    if (error) {
      if (error.code === 'AlreadyConnectedToReader') {
        console.log('connectedReader data:', reader);
        postWebMessage('goodbricks.updateReaderInfo', reader);
      } else if (error.code === 'MustBeDiscoveringToConnect') {
        const {error} = await discoverReaders({
          discoveryMethod: 'bluetoothScan',
          simulated: false,
        });
        console.log('### Discover readers 2 ###');
        if (error) {
          const {code, message} = error;
          console.log('Discover readers error: ', `${code}, ${message}`);
        }
      } else {
        console.log('connectBluetoothReader error:', error);
      }
    } else {
      console.log('connectedReader data:', connectedReader);
      postWebMessage(
        'goodbricks.readerDisplayUpdated',
        `Reader discovered and connected. ${connectedReader.serialNumber}`,
      );
      postWebMessage('goodbricks.readerConnected', connectedReader);
    }
  };

  const doDiscoverAndConnectReader = async eventData => {
    if (discoveredReaders.length !== 0) {
      console.log('discoveredReaders found 1: ', discoveredReaders[0]);
      await doConnectReader(discoveredReaders[0]);
    } else {
      console.log('### Discover readers 1 ###');
      const {error} = await discoverReaders({
        discoveryMethod: 'bluetoothScan',
        simulated: eventData.simulated,
      });
      console.log('### Discover readers 2 ###');
      if (error) {
        const {code, message} = error;
        console.log('Discover readers error: ', `${code}, ${message}`);
      }
    }
  };

  const doCreatePaymentIntent = async eventData => {
    console.log('### doCreatePaymentIntent ###', eventData);
    createPaymentIntent({
      amount: eventData.paymentIntent.amount * 100,
      currency: 'usd',
      paymentMethodTypes: ['card_present'],
    }).then(createPaymentIntent => {
      if (createPaymentIntent.paymentIntent.id) {
        console.log('### createPaymentIntent 1 ###', createPaymentIntent);
        collectPaymentMethod({
          paymentIntentId: createPaymentIntent.paymentIntent.id,
        }).then(async collectPaymentIntent => {
          if (collectPaymentIntent.error) {
            console.log(
              '### paymentIntent error ###',
              collectPaymentIntent.error.message,
            );
            return;
          }
          console.log('### collectPaymentMethod ###', collectPaymentIntent);
          const {error, processPaymentIntent} = await processPayment(
            collectPaymentIntent.paymentIntent.id,
          );
          if (error) {
            console.log('### paymentIntent error ###', error);
            postWebMessage('goodbricks.showProcessingError', error.message);
            return;
          }
          console.log('### paymentIntent ###', processPaymentIntent);
          postWebMessage(
            'goodbricks.paymentIntentCreated',
            collectPaymentIntent.paymentIntent.id,
          );
        });
      }
    });
  };

  const doCancelPaymentIntent = async eventData => {
    const response = await cancelCollectPaymentMethod();
    postWebMessage(
      'goodbricks.paymentIntentCancelled',
      'Cancelled Payment intent',
    );
    console.log('### paymentIntentCancelled ###', response);
  };

  const doCreatePaymentMethod = async eventData => {
    const {paymentMethod, error} = await readReusableCard({});
    if (error) {
      console.log('### PaymentMethod error ###', error);
      postWebMessage('goodbricks.showProcessingError', error.message);
      return;
    }
    console.log('### PaymentMethodCreated ###', paymentMethod.id);
    postWebMessage('goodbricks.paymentMethodCreated', paymentMethod.id);
    postWebMessage('goodbricks.updateReaderStatus', 'Processing payment...');
    console.log('### paymentMethodCreated ###', paymentMethod);
  };

  const doFetchConnectedReaderInfo = async eventData => {
    postWebMessage('goodbricks.updateReaderInfo', discoveredReaders[0]);
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
    console.log('### event ###', event.nativeEvent.data);
    const {data} = event.nativeEvent;
    const eventData = JSON.parse(data);
    switch (eventData.event) {
      case 'initializeTerminalForOrganization':
        if (
          eventData.data.organizationPublicId === connectedReaderOrganization
        ) {
          doDiscoverAndConnectReader(eventData);
          break;
        }
        props.onUpdateOrganizationPublicId(eventData.data.organizationPublicId);
        if (discoveredReaders[0]) {
          await disconnectReader();
          console.log('### disconnected ###');
        }
        setConnectedReaderOrganization(eventData.data.organizationPublicId);
        // await sleep(3000);
        await doDiscoverAndConnectReader(eventData);
        setConnectedReaderOrganization(eventData.data.organizationPublicId);
        break;
      case 'discoverAndConnectReader':
        doDiscoverAndConnectReader(eventData.data);
        break;
      case 'createPaymentIntent':
        doCreatePaymentIntent(eventData.data);
        console.log('### createPaymentIntent ###');
        break;
      case 'createPaymentMethod':
        doCreatePaymentMethod(eventData.data);
        console.log('### createPaymentMethod ###');
        break;
      case 'cancelPaymentIntent':
        console.log('### cancelPaymentIntent ###', eventData.data);
        doCancelPaymentIntent(eventData.data);
        break;
      case 'getConnectedReaderInfo':
        doFetchConnectedReaderInfo(eventData.data);
        console.log('### getConnectedReaderInfo ###');
        break;
      default:
        console.log('### default ###');
        break;
    }
  };

  const sleep = ms => new Promise(r => setTimeout(r, ms));

  return (
    <WebView
      ref={webViewRef}
      source={{uri: 'https://terminal.sandbox.goodbricksapp.com'}}
      style={{marginTop: 50}}
      onMessage={handleOnMessage}
      javaScriptEnabled={true}
      injectedJavaScript={runFirst}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

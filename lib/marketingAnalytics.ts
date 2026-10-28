import analytics from '@react-native-firebase/analytics';

export async function trackSignUp(method: string) {
  try {
    await analytics().logSignUp({
      method: method,
    });
    console.log('🔥 Firebase: Sign Up Tracked');
  } catch (error) {
    console.warn('Firebase Analytics sign_up event failed:', error);
  }
}

export async function trackLogin(method: string) {
  try {
    await analytics().logLogin({
      method: method,
    });
    console.log('🔥 Firebase: Login Tracked');
  } catch (error) {
    console.warn('Firebase Analytics login event failed:', error);
  }
}

export async function trackPurchase(
  transactionId: string | undefined,
  value: number,
  shipping: number,
  items: {
    item_id: string;
    item_name: string;
    price: number;
    quantity: number;
  }[]
) {
  try {
    await analytics().logPurchase({
      transaction_id: transactionId,
      currency: 'AFN',
      value: value,
      shipping: shipping,
      items: items.map(item => ({
        item_id: item.item_id,
        item_name: item.item_name,
        price: item.price,
        quantity: item.quantity,
      })),
    });
    console.log('🔥 Firebase: Purchase Tracked');
  } catch (error) {
    console.warn('Firebase Analytics purchase event failed:', error);
  }
}

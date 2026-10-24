import {
  getAnalytics,
  logLogin,
  logPurchase,
  logSignUp,
} from '@react-native-firebase/analytics';

export async function trackSignUp(method: string) {
  try {
    await logSignUp(getAnalytics(), { method });
  } catch (error) {
    console.warn('Firebase Analytics sign_up event failed:', error);
  }
}

export async function trackLogin(method: string) {
  try {
    await logLogin(getAnalytics(), { method });
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
    await logPurchase(getAnalytics(), {
      transaction_id: transactionId,
      currency: 'AFN',
      value,
      shipping,
      items,
    });
  } catch (error) {
    console.warn('Firebase Analytics purchase event failed:', error);
  }
}

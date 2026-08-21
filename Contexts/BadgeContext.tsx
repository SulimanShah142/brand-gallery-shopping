// Contexts/BadgeContext.tsx -> Unified Dynamic Badge Hub
import React, { createContext, useContext, useState, useEffect } from 'react';
import { OneSignal, NotificationWillDisplayEvent } from 'react-native-onesignal';

type BadgeContextType = {
  adminOrdersBadge: number;
  userChatBadge: number;
  delivererOrdersBadge: number;
  clearAdminOrders: () => void;
  clearUserChat: () => void;
  clearDelivererOrders: () => void;
};

const BadgeContext = createContext<BadgeContextType | null>(null);

export function BadgeProvider({ children }: { children: React.ReactNode }) {
  const [adminOrdersBadge, setAdminOrdersBadge] = useState(0);
  const [userChatBadge, setUserChatBadge] = useState(0);
  const [delivererOrdersBadge, setDelivererOrdersBadge] = useState(0);

  useEffect(() => {
    // 🎯 THE ONESIGNAL PUSH INTERCEPTOR EVENT LISTENER
    // Fires instantly when a notification drops out of the cloud while the app is running!
    const handleIncomingNotification = (event: NotificationWillDisplayEvent) => {
      const payload = event.getNotification();
      const rawData: any = payload.additionalData;
      
      console.log("🛰️ Unified Badge System Intercepted Push Payload:", JSON.stringify(rawData));

      // Route A: Admin Order Placed Signal
      if (rawData?.type === 'NEW_ORDER_ADMIN') {
        setAdminOrdersBadge(prev => prev + 1);
      }
      // Route B: User Support Chat Message Signal
      if (rawData?.type === 'NEW_CHAT_MESSAGE_USER') {
        setUserChatBadge(prev => prev + 1);
      }
      // Route C: Deliverer Package Assignment Signal
      if (rawData?.type === 'NEW_ASSIGNMENT_DELIVERER') {
        setDelivererOrdersBadge(prev => prev + 1);
      }
    };

    OneSignal.Notifications.addEventListener('foregroundWillDisplay', handleIncomingNotification);

    return () => {
      OneSignal.Notifications.removeEventListener('foregroundWillDisplay', handleIncomingNotification);
    };
  }, []);

  const clearAdminOrders = () => setAdminOrdersBadge(0);
  const clearUserChat = () => setUserChatBadge(0);
  const clearDelivererOrders = () => setDelivererOrdersBadge(0);

  return (
    <BadgeContext.Provider value={{
      adminOrdersBadge,
      userChatBadge,
      delivererOrdersBadge,
      clearAdminOrders,
      clearUserChat,
      clearDelivererOrders
    }}>
      {children}
    </BadgeContext.Provider>
  );
}

export const useBadges = () => {
  const context = useContext(BadgeContext);
  if (!context) throw new Error("useBadges must be wrapped inside a BadgeProvider");
  return context;
};

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { 
  View, FlatList, TextInput, TouchableOpacity, Image, 
  Text, StyleSheet, Platform, ActivityIndicator, KeyboardAvoidingView, 
  Alert, Keyboard, TouchableWithoutFeedback, Dimensions, SafeAreaView, AppState
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { Ionicons } from '@expo/vector-icons';
import * as ImageManipulator  from "expo-image-manipulator"
import { 
  getOrCreateConversation, addLocalMessage, loadMessages, 
} from '../../lib/offline';
import { uploadImage } from '../../lib/uploadthing';
import { authClient } from '@/lib/auth-client';
import { useLanguage } from '@/Contexts/LanguageContext';
import {useBottomTabBarHeight} from "@react-navigation/bottom-tabs";
import { API_URL } from '@/lib/config';
import { OneSignal } from 'react-native-onesignal';

const { width } = Dimensions.get('window');

export default function ChatScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const { t, isRTL } = useLanguage();
  const { data: authData, isPending: sessionLoading } = authClient.useSession();

  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [activeUserId, setActiveUserId] = useState<string>("");
  const [input, setInput] = useState("");
  
  const [isSending, setIsSending] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
// 🎯 CHAT FRAMEWORK CORE STATE HOOKS LAYER
const [messages, setMessages] = useState<any[]>([]);          // Chronological message stream log
const [inputText, setInputText] = useState('');              // Live text container tracking inputs
const [loading, setLoading] = useState(true);                // Thread loading initialization tracker
const [sending, setSending] = useState(false);              // Binary blocker for the media upload loop

// 🎯 HIGH-UTILITY SHEIN-STYLE ATTACHMENT MEDIA CAROUSEL STATES
const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);
const [selectedRemoteImageUrl, setSelectedRemoteImageUrl] = useState<string | null>(null); // Temporary file:// asset slot
  const [uploadedPhotos, setUploadedPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

// 🎯 REAL-TIME SYSTEM SYNC CONTROLS
const [refreshing, setRefreshing] = useState(false);        // Pull-to-refresh timeline layout trigger
const [cachedUser, setCachedUser] = useState<any>(null);      // Local profile matching indices payload

  const flatListRef = useRef<FlatList>(null);
  const orderContextSentRef = useRef<string | null>(null);

  const orderIdParam = Array.isArray(params.orderId) ? params.orderId[0] : params.orderId;
  const orderItemNameParam = Array.isArray(params.orderItemName) ? params.orderItemName[0] : params.orderItemName;
  const orderImageUrlParam = Array.isArray(params.orderImageUrl) ? params.orderImageUrl[0] : params.orderImageUrl;

  const refreshMessages = useCallback(async (convId: string) => {
    if (!convId) return;
    const localMessages = await loadMessages(convId);
    setMessages(localMessages || []);
    // Slight timeout allows layouer frame adjustments to process cleanly
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 60);
  }, []);

  const refreshFromServer = useCallback(async (convId: string) => {
    if (!convId) return;

      // Render the local conversation immediately, then refresh it from the server.
      // This keeps the chat usable while the network request is in flight.
      const cachedMessages = await loadMessages(convId).catch(() => []);
      if (Array.isArray(cachedMessages)) {
        setMessages(cachedMessages);
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 0);
      }

    try {
      const response = await fetch(
        `${API_URL}/api/conversations/${convId}/messages`,
      );

      if (!response.ok) return;

      const serverMessages = await response.json();
      if (!Array.isArray(serverMessages)) return;

      for (const message of serverMessages) {
        await addLocalMessage({
          ...message,
          isSyncedToServer: 1,
        }).catch(() => {});
      }

      await refreshMessages(convId);
    } catch (error) {
      console.warn('Chat server refresh failed:', error);
    }
  }, [refreshMessages]);

  useEffect(() => {
    if (!activeConvId) return;

    const refreshForNotification = (event: any) => {
      const notification = event?.getNotification?.();
      const data = notification?.additionalData || {};
      const notificationConversationId = data?.conversationId;

      if (
        notificationConversationId &&
        String(notificationConversationId) !== String(activeConvId)
      ) {
        return;
      }

      void refreshFromServer(activeConvId);
    };

    OneSignal.Notifications.addEventListener(
      'foregroundWillDisplay',
      refreshForNotification,
    );

    const appStateSubscription = AppState.addEventListener(
      'change',
      (nextState) => {
        if (nextState === 'active') {
          void refreshFromServer(activeConvId);
        }
      },
    );

    return () => {
      OneSignal.Notifications.removeEventListener(
        'foregroundWillDisplay',
        refreshForNotification,
      );
      appStateSubscription.remove();
    };
  }, [activeConvId, refreshFromServer]);

   // 🎯 THE CUSTOM AUTHENTICATION FRONTEND INITIALIZER FIX:
  // Reads your true custom authenticated profile details straight out of SecureStore!
    // 🎯 THE CUSTOM AUTH LINKED FIX:
  // This extracts the genuine customer user id dynamically out of your custom auth client hook!

useEffect(() => {
  let cancelled = false;

  const initializeChat = async () => {
    // wait until session resolves (IMPORTANT)
    if (sessionLoading) return;

    try {
      const realUserId = authData?.user?.id;

      // ❌ NOT LOGGED IN → create a local offline conversation so chat UI still works
      if (!realUserId) {
        const offlineId = 'offline-user';
        setActiveUserId(offlineId);

        const conv = await getOrCreateConversation(offlineId).catch(() => null);
        const convId = (conv as any)?.id || null;

        setMessages([]);
        setActiveConvId(convId);
        setHistoryLoading(false);
        return;
      }

      // ✅ VALID USER
      const userId = (params.userId as string) || realUserId;

      setActiveUserId(userId);

      // Route parameters can be stale after logout/login. Resolve the canonical
      // server-backed room for the authenticated account every time.
      const conv = await getOrCreateConversation(userId);
      const convId: string | null = (conv as any)?.id || null;

      if (cancelled) return;

      if (convId) {
        // IMPORTANT: reset old chat before switching
        setMessages([]);
        setActiveConvId(convId);
      }

    } catch (err) {
      console.error("❌ Chat init error:", err);
    }
  };

  initializeChat();

  return () => {
    cancelled = true;
  };
}, [sessionLoading, authData?.user?.id, params.userId, params.conversationId]);

useEffect(() => {
  const orderId = String(orderIdParam || '').trim();
  if (!activeConvId || !activeUserId || !orderId) return;

  const contextKey = `${activeConvId}:${orderId}`;
  if (orderContextSentRef.current === contextKey) return;
  orderContextSentRef.current = contextKey;

  const ensureOrderReference = async () => {
    try {
      const existingResponse = await fetch(`${API_URL}/api/conversations/${activeConvId}/messages`);
      const existingMessages = existingResponse.ok ? await existingResponse.json() : [];
      const marker = `Order reference: ${orderId}`;
      if (Array.isArray(existingMessages) && existingMessages.some((message: any) => String(message.content || '').includes(marker))) return;

      const content = `${marker}${orderItemNameParam ? `\nItem: ${orderItemNameParam}` : ''}`;
      const createdAt = new Date().toISOString();
      const messageId = Crypto.randomUUID();
      const token = await SecureStore.getItemAsync('custom_user_session_token').catch(() => '');
      const response = await fetch(`${API_URL}/api/conversations/${activeConvId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${String(token || '').trim()}`,
        },
        body: JSON.stringify({
          id: messageId,
          conversationId: activeConvId,
          senderId: activeUserId,
          content,
          attachmentUrl: String(orderImageUrlParam || '').trim() || null,
          createdAt,
        }),
      });
      if (!response.ok) throw new Error('Order reference message was rejected');

      await addLocalMessage({
        id: messageId,
        conversationId: activeConvId,
        senderId: activeUserId,
        content,
        attachmentUrl: String(orderImageUrlParam || '').trim() || null,
        isRead: 1,
        isSyncedToServer: 1,
        createdAt,
      }).catch(() => {});
      await refreshFromServer(activeConvId);
    } catch (error) {
      orderContextSentRef.current = null;
      console.warn('Could not add order reference to chat:', error);
    }
  };

  void ensureOrderReference();
}, [activeConvId, activeUserId, orderIdParam, orderImageUrlParam, orderItemNameParam, refreshFromServer]);

useEffect(() => {
  const userId = authData?.user?.id;

  if (!userId) {
    setActiveUserId('');
    setActiveConvId(null);
    setMessages([]);
    setHistoryLoading(false);
    setInputText('');
    setSelectedImageUri(null);
  }
}, [authData?.user?.id]);
 // 🎯 Removed better-auth sessionLoading watchers completely!
useEffect(() => {
  if (!activeConvId) return;

  let alive = true;

  const loadChronology = async () => {
    try {
      setHistoryLoading(true);

      await refreshFromServer(activeConvId);

      if (!alive) return;
    } catch (e) {
      console.error("history load error:", e);
    } finally {
      if (alive) setHistoryLoading(false);
    }
  };

  loadChronology();

  const interval = setInterval(() => {
    if (alive && activeConvId) {
      void refreshFromServer(activeConvId);
    }
  }, 5000);

  return () => {
    alive = false;
    clearInterval(interval);
  };
}, [activeConvId, refreshFromServer]);
   // 🎯 THE COMPLIANT DISPATCH CONTEXT LAYER
  // ==========================================
  // 🎯 THE DISAPPEARING MESSAGE CURE (SYNCHRONIZED DISPATCH)
const handleSend = async () => {
  if ((!inputText.trim() && !selectedRemoteImageUrl) || uploading) return;
  if (!activeConvId) return;

  const typedTextSnapshot = inputText.trim();

  // local preview
  const localImagePreview = selectedImageUri;

  // uploadthing url
  const remoteImageUrl = selectedRemoteImageUrl;

  setInputText('');
  setSelectedImageUri(null);
  setSelectedRemoteImageUrl(null);

  setSending(true);

  let messageId: string;
  try {
    messageId = (Crypto && (Crypto as any).randomUUID) ? (Crypto as any).randomUUID() : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  } catch (e) {
    messageId = `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
  const timestamp = new Date().toISOString();

  const localMessage = {
    id: messageId,
    conversationId: activeConvId,
    senderId: activeUserId,
    content: typedTextSnapshot,
    attachmentUrl: localImagePreview,
    isRead: false,
    createdAt: timestamp,
  };

  try {
    // save locally first
    await addLocalMessage({
      ...localMessage,
      isRead: 1,
      isSyncedToServer: 0,
    }).catch(() => {});

    await refreshMessages(activeConvId);

    const SecureStore = require('expo-secure-store');

    const token =
      (await SecureStore.getItemAsync(
        'custom_user_session_token'
      )) || '';

    const response = await fetch(
      `${API_URL}/api/conversations/${activeConvId}/messages`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token.trim()}`,
        },
        body: JSON.stringify({
          id: messageId,
          conversationId: activeConvId,
          senderId: activeUserId,
          content: typedTextSnapshot,
          attachmentUrl: remoteImageUrl,
          createdAt: timestamp,
        }),
      }
    );

    if (!response.ok) {
      throw new Error('Message send failed');
    }

    await addLocalMessage({
      id: messageId,
      conversationId: activeConvId,
      senderId: activeUserId,
      content: typedTextSnapshot,
      attachmentUrl: remoteImageUrl || localImagePreview,
      isRead: 1,
      isSyncedToServer: 1,
      createdAt: timestamp,
    }).catch(() => {});

    console.log('✅ Message sent successfully');
  } catch (err) {
    console.error('❌ Send error:', err);

    Alert.alert(
      t('sendFailed') || 'Send Failed',
      t('savedLocally') || 'Message saved locally and will sync later.'
    );
  } finally {
    await refreshMessages(activeConvId);
    setSending(false);
  }
};


  // 🎯 THE PICKER IMAGE FIX: Update states directly instead of crashing handlers with string parameters
const handlePickAndUploadImage = async () => {
  try {
    const permissionResult =
      await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permissionResult.granted) {
      Alert.alert(
        t('permissionBlocked') || 'Permission Blocked',
        t('galleryRequired') || 'Gallery access is required.'
      );
      return;
    }

    const pickerResult = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.5,
    });

    if (pickerResult.canceled || !pickerResult.assets?.[0]) {
      return;
    }

    setUploading(true);

    const optimizedImage =
      await ImageManipulator.manipulateAsync(
        pickerResult.assets[0].uri,
        [{ resize: { width: 600 } }],
        {
          compress: 0.3,
          format: ImageManipulator.SaveFormat.JPEG,
        }
      );

    const remoteCdnUrl = await uploadImage(
      optimizedImage.uri
    );

    if (!remoteCdnUrl) {
      throw new Error('UploadThing returned empty URL');
    }

    console.log(
      '🚀 UploadThing URL:',
      remoteCdnUrl
    );

    // local preview
    setSelectedImageUri(optimizedImage.uri);

    // IMPORTANT
    setSelectedRemoteImageUrl(remoteCdnUrl);

    setUploadedPhotos(prev => [
      ...prev,
      remoteCdnUrl,
    ]);

    Alert.alert(
      t('photoAttached') || 'Success',
      t('photoAttachedBody') ||
        'Photo attached successfully!'
    );
  } catch (e: any) {
    console.error(
      '❌ Media upload failed:',
      e?.message
    );

    Alert.alert(
      t('uploadStalled') || 'Upload Failed',
      t('uploadStalledBody') ||
        'Could not upload image.'
    );
  } finally {
    setUploading(false);
  }
};

  const [keyboardPadding, setKeyboardPadding] = useState(0);
  
  let tabBarHeight = 0;
  try {
    tabBarHeight = useBottomTabBarHeight();
  } catch (e) {
    tabBarHeight = 0; 
  }

  useEffect(() => {
    const showListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', 
      (e) => {
        const calculatedPadding = e.endCoordinates.height - (Platform.OS === 'android' ? tabBarHeight : 0);
        setKeyboardPadding(calculatedPadding > 0 ? calculatedPadding : 0);
      }
    );
    
    const hideListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', 
      () => {
        setKeyboardPadding(0);
      }
    );

    return () => {
      showListener.remove();
      hideListener.remove();
    };
  }, [tabBarHeight]);


  // =========================================================================
  // 🎯 HIGH-PERFORMANCE CHAT ELEMENT CELL CONTAINER (DEPENDENCY ALIGNED)
  // =========================================================================
  const renderMessageItem = useCallback(({ item }: { item: any }) => {
    const rawSenderId = String(item.senderId || '').trim().toLowerCase();
    const rawActiveUserId = String(activeUserId || '').trim().toLowerCase();

    // 🎯 THE COMPLIANT IDENTIFICATION CURE:
    // If the message senderId matches your own active shopper account user ID, 
    // it goes to the RIGHT. If it doesn't match, it's an admin reply and goes to the LEFT!
    const isMe = rawSenderId.length > 0 && 
                 rawSenderId === rawActiveUserId &&
                 rawSenderId !== "admin";


                 console.log({
  messageSender: item.senderId,
  activeUserId,
  isMe
});
    const cleanMessageText = item.content?.trim() || '';
    const mediaAttachmentPathUrl = item.attachmentUrl || item.attachment_url || null;

    return (
      <View style={[
        styles.bubbleRow, 
        isMe ? styles.rowMeRight : styles.rowThemLeft,
             ]}>
        <View style={[
          styles.bubbleContainer,
          isMe ? styles.bubbleMe : styles.bubbleThem
        ]}>
          
          {/* THE IMAGE ATTACHMENT CARD */}
          {mediaAttachmentPathUrl && mediaAttachmentPathUrl.trim().length > 0 && (
            <View style={styles.bubbleImageContainerWrapper}>
              <Image 
                source={{ uri: mediaAttachmentPathUrl.trim() }} 
                style={styles.bubbleAttachmentImageMedia} 
                resizeMode="cover" 
              />
            </View>
          )}

          {/* Render text box boundaries only if text message parameter exists */}
          {cleanMessageText.length > 0 && (
            <Text style={[
              styles.bubbleMessageText, 
              isMe ? styles.textMe : styles.textThem
            ]}>
              {cleanMessageText}
            </Text>
          )}

          {/* Minimal design timestamp indicator block */}
          <Text style={[styles.bubbleTimestamp, isMe ? styles.timeMe : styles.timeThem]}>
            {item.createdAt ? new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
          </Text>
        </View>
      </View>
    );
  }, [activeUserId, isRTL]); // 🎯 FIXED: Added activeUserId here so the hook recalculates instantly!


  if (!activeConvId || sessionLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="small" color="#000000" />
        <Text style={styles.initText}>
          {t('initializingConnectivity') || 'INITIALIZING CONNECTIVITY...'}
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* HIGH-END BLACK/WHITE EDITORIAL HEADER */}
      <View style={[styles.header, isRTL && { flexDirection: 'row-reverse' }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name={isRTL ? "arrow-back" : "arrow-back"} size={20} color="#000000" />
        </TouchableOpacity>
        
        {/* TRANSLATED EDITORIAL CHAT TITLES */}
        <View style={[styles.titleWrapper]}>
          <Text style={styles.headerTitle}>
            {t('brandGallerySupport') || 'BRAND GALLERY SUPPORT'}
          </Text>
          <Text style={styles.headerSubtitle}>
            {t('onlineAssistanceChannel') || 'ONLINE ASSISTANCE CHANNEL'}
          </Text>
        </View>
        <View style={styles.headerActionSlot} />
      </View>

      {!!orderIdParam && (
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#F5F5F5', borderBottomWidth: 1, borderBottomColor: '#E8E8E8' }}>
          {orderImageUrlParam ? (
            <Image source={{ uri: String(orderImageUrlParam) }} style={{ width: 42, height: 42, borderRadius: 4, backgroundColor: '#E5E5E5' }} />
          ) : (
            <Ionicons name="cube-outline" size={28} color="#555" />
          )}
          <View style={{ marginLeft: 10, flex: 1 }}>
            <Text style={{ color: '#666', fontSize: 10, fontWeight: '700' }}>ORDER REFERENCE</Text>
            <Text style={{ color: '#111', fontSize: 12, fontWeight: '800' }} numberOfLines={1}>#{String(orderIdParam)}</Text>
            {!!orderItemNameParam && <Text style={{ color: '#666', fontSize: 11 }} numberOfLines={1}>{String(orderItemNameParam)}</Text>}
          </View>
        </View>
      )}

      {/* Sign-in warning banner for offline/local chat */}
      {!authData?.user && (
        <View style={{ backgroundColor: '#FFF4E5', padding: 12, borderBottomWidth: 1, borderBottomColor: '#F2E6D6' }}>
          <Text style={{ color: '#7A4B00', fontWeight: '700', marginBottom: 6 }}>{t('chatSignInRequired') || 'Sign in to use cloud chat'}</Text>
          <Text style={{ color: '#7A4B00', fontSize: 12, marginBottom: 8 }}>{t('chatLocalMode') || 'You can still use local chat; messages will be saved on this device.'}</Text>
          <TouchableOpacity onPress={() => router.push('/(auth)/sign-in')} style={{ alignSelf: 'flex-start', backgroundColor: '#000', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 }}>
            <Text style={{ color: '#fff', fontWeight: '800' }}>{t('signIn') || 'SIGN IN'}</Text>
          </TouchableOpacity>
        </View>
      )}

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'android' ? tabBarHeight : 0}
      >
        {/* 🎯 THE OVERLAY LOADING SHIELD CONTAINER:
            While historyLoading is locked, render a clean, high-density minimalist spinner 
            to hide component box flashes completely! */}
        {historyLoading ? (
          <View style={styles.historyLoader}>
            <ActivityIndicator size="small" color="#000000" />
            <Text style={styles.loadingText}>
              {(t('loadingConversation') || 'LOADING CONVERSATION...').toUpperCase()}
            </Text>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item, idx) => item.id?.toString() || `msg-${idx}`}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[styles.listContainer, { direction: 'ltr', paddingBottom: 32 }]}
            renderItem={renderMessageItem}
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          />
        )}

        {/* PREVIEW ATTACHMENT MINI BAR SLAT */}
        {selectedImageUri && (
          <View style={[styles.previewSlatRow, isRTL && { flexDirection: 'row-reverse' }]}>
            <Image source={{ uri: selectedImageUri }} style={styles.miniPreviewThumb} />
            <TouchableOpacity style={styles.clearMiniThumbBtn} onPress={() => setSelectedImageUri(null)}>
              <Ionicons name="close-circle" size={18} color="#FF3B30" />
            </TouchableOpacity>
          </View>
        )}

        {/* INPUT ACCESSORY TOOLBAR DOCK AREA */}
        <View style={[styles.inputToolbarDockRow, isRTL && { flexDirection: 'row-reverse' }]}>
          <TouchableOpacity style={styles.toolbarMediaBtn} onPress={handlePickAndUploadImage} disabled={sending}>
            <Ionicons name="camera-outline" size={22} color="#000000" />
          </TouchableOpacity>
          
          <TextInput
            style={[styles.toolbarTextInputField, isRTL && { textAlign: 'right' }]}
            placeholder={t('typeYourMessage') || "TYPE YOUR MESSAGE..."}
            placeholderTextColor="#999999"
            value={inputText}
            onChangeText={setInputText}
            multiline
            editable={!sending}
          />

          <TouchableOpacity 
            style={[styles.toolbarSubmitSendBtn, (!inputText.trim() && !selectedImageUri) && { opacity: 0.4 }]} 
            onPress={handleSend}
            disabled={sending || (!inputText.trim() && !selectedImageUri)}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#000000" />
            ) : (
              <Ionicons name="arrow-up-circle-sharp" size={26} color="#000000" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}


const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF' },
  initText: { fontSize: 10, fontWeight: '700', letterSpacing: 1.5, marginTop: 12, color: '#444444' },
  
   textMe: { color: '#FFFFFF' },
  textThem: { color: '#000000' },
  
 header: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',

  paddingTop: Platform.OS === 'android' ? 44 : 12,
  paddingHorizontal: 18,
  paddingBottom: 16,

  backgroundColor: '#FFFFFF',

  borderBottomWidth: 1,
  borderBottomColor: '#F1F1F1',

  shadowColor: '#000',
  shadowOffset: {
    width: 0,
    height: 2,
  },
  shadowOpacity: 0.03,
  shadowRadius: 8,

  elevation: 2,
},
    // 🎯 HIGH-END INTERACTIVE ACCESSORY CHAT TOOLBAR LAYOUT DESIGNS
  inputToolbarDockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#F5F5F5',
    width: '100%',
    gap: 12
  },
   historyLoader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    gap: 12
  },
  loadingText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#666666',
    letterSpacing: 1.5,
    marginTop: 4
  },
  toolbarMediaBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F9FAFB',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: '#E5E7EB'
  },
  toolbarTextInputField: {
    flex: 1,
    backgroundColor: '#FAFAFA',
    borderWidth: 1,
    borderColor: '#EAEAEA',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 10 : 6,
    paddingBottom: Platform.OS === 'ios' ? 10 : 6,
    fontSize: 13,
    color: '#000000',
    fontWeight: '500',
    maxHeight: 100,
    textAlignVertical: 'center'
  },
  toolbarSubmitSendBtn: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center'
  },

  // MEDIA PICKER PREVIEW HUD PANEL MANIFEST SLATS
  previewSlatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: 0.5,
    borderTopColor: '#E5E7EB',
    position: 'relative'
  },
  miniPreviewThumb: {
    width: 48,
    height: 64,
    backgroundColor: '#EEEEEE',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 2
  },
  rowMeRight: {
  justifyContent: 'flex-end',
},

rowThemLeft: {
  justifyContent: 'flex-start',
},
  clearMiniThumbBtn: {
    position: 'absolute',
    top: 6,
    left: 56, // Dynamically positions closing tags right near thumbnail badges margins
    backgroundColor: '#FFFFFF',
    borderRadius: 9,
    zIndex: 10
  },
  
 backButton: {
  width: 38,
  height: 38,

  borderRadius: 19,

  justifyContent: 'center',
  alignItems: 'center',

  backgroundColor: '#F8F8F8',

  borderWidth: 1,
  borderColor: '#F0F0F0',
},
  titleWrapper: { alignItems: 'center', flex: 1 },
headerTitle: {
  fontSize: 14,
  fontWeight: '900',
  color: '#111111',

  letterSpacing: 1.4,
},

headerSubtitle: {
  fontSize: 10,

  color: '#888888',

  marginTop: 3,

  fontWeight: '600',

  letterSpacing: 0.5,
},
 headerActionSlot: { width: 24, alignItems: 'center' },

  listContainer: {
  paddingHorizontal: 18,
  paddingTop: 20,
  paddingBottom: 40,
},
  msgContainer: { width: '100%', marginBottom: 16, flexDirection: 'row' },
  myMsgAlign: { justifyContent: 'flex-end' },
  theirMsgAlign: { justifyContent: 'flex-start' },
  
 bubble: {
  maxWidth: width * 0.76,

  paddingHorizontal: 14,
  paddingVertical: 12,

  borderRadius: 18,

  position: 'relative',
},
myBubble: {
  backgroundColor: '#111111',

  borderBottomRightRadius: 6,
},
 theirBubble: {
  backgroundColor: '#FAFAFA',

  borderWidth: 1,
  borderColor: '#EFEFEF',

  borderBottomLeftRadius: 6,
},
bubbleImage: {
  width: width * 0.55,

  aspectRatio: 4 / 3,

  borderRadius: 14,

  marginBottom: 8,

  backgroundColor: '#F3F3F3',
}, 
  // 🎯 INJECT THESE DESIGN DICTIONARY ARRAYS TO PRESERVE MONOCHROME CELL SHARPNESS:
  bubbleRow: {
    flexDirection: 'row',
    marginBottom: 12,
    paddingHorizontal: 14,
    width: '100%'
  },
  bubbleContainer: {
    maxWidth: '75%',
    padding: 10,
    borderRadius: 16,
    position: 'relative'
  },
  bubbleMe: {
    backgroundColor: '#000000', // Premium sleek sharp black theme capsule for the sender
    borderBottomRightRadius: 4,
  },
  bubbleThem: {
    backgroundColor: '#F2F2F7', // Clean light gray context block for administrative replies
    borderBottomLeftRadius: 4,
  },
  bubbleMessageText: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
    marginTop: 2
  },
  bubbleTextMe: {
    color: '#FFFFFF'
  },
  bubbleTextThem: {
    color: '#000000'
  },
  bubbleTimestamp: {
    fontSize: 8,
    fontWeight: '600',
    marginTop: 4,
    alignSelf: 'flex-end',
    letterSpacing: 0.5
  },
  timeMe: {
    color: 'rgba(255,255,255,0.6)'
  },
  timeThem: {
    color: '#8E8E93'
  },

  // 🎯 THE MEDIA VIEWPORT LOCK MATRIX:
  // Enforces a neat, stable layout dimension bounding box for incoming pictures
  bubbleImageContainerWrapper: {
    width: 220,
    height: 160,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#E5E5EA',
    marginBottom: 4,
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.05)'
  },
  bubbleAttachmentImageMedia: {
    width: '100%',
    height: '100%'
  },

  msgText: { fontSize: 12, lineHeight: 18, letterSpacing: 0.4 },
  myMsgText: { color: '#FFFFFF', fontWeight: '400' },
  theirMsgText: { color: '#111111', fontWeight: '400' },
  
  timestamp: { fontSize: 8, marginTop: 4, alignSelf: 'flex-end', fontWeight: '500' },
  myTimestamp: { color: '#AAAAAA' },
  theirTimestamp: { color: '#999999' },

inputDockContainer: {
  flexDirection: 'row',
  alignItems: 'center',

  paddingHorizontal: 18,
  paddingTop: 12,
  paddingBottom: 14,

  backgroundColor: '#FFFFFF',

  borderTopWidth: 1,
  borderTopColor: '#F1F1F1',

  shadowColor: '#000',
  shadowOffset: {
    width: 0,
    height: -3,
  },
  shadowOpacity: 0.03,
  shadowRadius: 8,

  elevation: 4,

  gap: 12,
},

 attachBtn: {
  width: 46,
  height: 46,

  borderRadius: 23,

  backgroundColor: '#FAFAFA',

  justifyContent: 'center',
  alignItems: 'center',

  borderWidth: 1,
  borderColor: '#EFEFEF',
},
 inputField: {
  flex: 1,

  height: 46,

  backgroundColor: '#FAFAFA',

  borderWidth: 1,
  borderColor: '#EFEFEF',

  borderRadius: 23,

  paddingHorizontal: 18,

  fontSize: 13,

  color: '#111111',

  fontWeight: '500',
},
 sendBtn: {
  width: 46,
  height: 46,

  borderRadius: 23,

  backgroundColor: '#111111',

  justifyContent: 'center',
  alignItems: 'center',

  shadowColor: '#000',
  shadowOffset: {
    width: 0,
    height: 4,
  },
  shadowOpacity: 0.08,
  shadowRadius: 8,

  elevation: 4,
},

  emptyContainer: { alignItems: 'center', marginTop: 140, gap: 10 },
  emptyText: { fontSize: 11, color: '#999999', fontWeight: '500', letterSpacing: 0.5 }
});

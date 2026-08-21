import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, StyleSheet, ActivityIndicator, Alert, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useLanguage } from '@/Contexts/LanguageContext';
import { authClient } from '@/lib/auth-client';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import * as SecureStore from 'expo-secure-store';
import { API_URL } from '@/lib/config';
import { OneSignal } from 'react-native-onesignal';
import { initOneSignal } from '@/lib/notiifcations';

export default function OTPLogin() {
  const router = useRouter();
  const { t, isRTL, locale } = useLanguage();
  
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  // 🎯 THE IDENTITY RESOLUTION CURE: Added a explicit name state hook to capture real profiles parameters!
  const [fullNameInput, setFullNameInput] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [isStepTwo, setIsStepTwo] = useState(false);
  const [isChecked, setIsChecked] = useState(false);

 
  // URL LINK POOLS FROM GOOGLE SITES
 const PRIVACY_URL = "https://sites.google.com/view/brand-gallery-1/privacy-policy";
  const TERMS_URL = "https://sites.google.com/view/temrs-of-service/terms-of-service";




  const handleOpenLink = async (targetUrl: string) => {
    try {
      await WebBrowser.openBrowserAsync(targetUrl);
    } catch (e) {
      Alert.alert("Error", "Could not render legal documents web view framework.");
    }
  };
 // 🎯 STAGE 1: TRIGGER SECURE VERIFICATION REQUEST DISPATCH VIA BACKEND
   // Inside app/(auth)/otp-login.tsx -> handleSendOTP function payload
  // Inside app/(auth)/otp-login.tsx -> handleSendOTP function payload

  // STAGE 1: TRIGGER SECURE VERIFICATION REQUEST DISPATCH VIA BACKEND
  const handleSendOTP = async () => {
    if (!isChecked) {
      return Alert.alert(t("error") || "Agreement Required", "You must accept the Terms of Service and Privacy Policy.");
    }
    if (!phone.trim()) {
      return Alert.alert(t("error") || "Error", locale === 'en' ? "Please enter your identifier" : "لطفاً معلومات خود را وارد کنید");
    }
    
    setLoading(true);
    try {
      const cleanPhoneDigits = phone.replace(/\s/g, ''); 
      await initOneSignal(cleanPhoneDigits).catch(() => {});

      const nativeSubscriptionStateId = await OneSignal.User.pushSubscription.getIdAsync().catch(() => null);
      const finalTrackingHeaderToken = nativeSubscriptionStateId || cleanPhoneDigits;

      try {
        OneSignal.User.addAlias("user_id", cleanPhoneDigits);
      } catch {}

      const res = await fetch(`${API_URL}/api/auth/email-otp/send-verification-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-onesignal-id': finalTrackingHeaderToken
        },
        body: JSON.stringify({ phone: cleanPhoneDigits })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setIsStepTwo(true);
        Alert.alert(
          "Code Sent", 
          locale === 'en' ? "A verification token has been routed via system channels." : "کد تایید ارسال گردید."
        );
      } else {
        Alert.alert(t("error") || "Failed", data.error || "Could not dispatch access tokens.");
      }
    } catch (err: any) {
      Alert.alert(t("error") || "Failed", "Network execution failed.");
    } finally {
      setLoading(false);
    }
  };
  // 🎯 HIGH-PERFORMANCE INSTANT AUTH-ROUTING VERIFICATION DISPATCH ENGINE (CLEANED)
  // 🎯 HIGH-PERFORMANCE INSTANT AUTH-ROUTING VERIFICATION DISPATCH ENGINE (RECONCILED SYNC)
  const handleVerifyOTP = async () => {
    if (!code.trim()) return Alert.alert(t("error") || "Error", "Enter verification code");
    
    setLoading(true);
    try {
      const cleanPhoneDigits = phone.replace(/\s/g, '');
      const phoneIdentifier = `${cleanPhoneDigits}@phone.local`;
      
      console.log(`📡 [OTP RECONCILIATION] Validating cryptographic access token for: ${phoneIdentifier}`);
      
      const res = await fetch(`${API_URL}/api/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: phoneIdentifier, 
          otp: code.trim()
        })
      });

      const data = await res.json();
      
      // 🎯 THE LIFECYCLE MATCH FIX: 
      // Verify the existence of data.session.token to precisely align with your 
      // direct password sign-in payload architecture structures!
      if (res.ok && data.success && data.session?.token) {
        console.log("✅ Custom OTP signature cleared. Burning secure hardware authentication keys...");
        
        // Persist token using imported SecureStore
        await SecureStore.setItemAsync('custom_user_session_token', data.session.token.trim());
        
        // Match direct password layout payload data mapping parameters precisely
        if (data.session.user) {
          await SecureStore.setItemAsync(
            'cached_user_profile', 
            JSON.stringify(data.session.user)
          ).catch(() => {});
        }

        // Hydrate your global central authClient proxy listener hook parameters synchronously
        // Refresh centralized session state so the app reacts to the newly stored token
        await authClient.refreshSession().catch(() => {});

        // Link OneSignal push channels to the authenticated user ID profile cell
        try {
          if (data.session.user?.id) {
            const { OneSignal } = require('react-native-onesignal');
            OneSignal.login(String(data.session.user.id).trim());
            OneSignal.User.addAlias("user_id", cleanPhoneDigits);
          }
        } catch {}

        console.log("🚀 [ROUTING RUNWAY] Security gates passed. Swapping view channels to home runway.");
        
        // Perform direct navigation transition cleanly
        router.replace('/');
        return; 
      } else {
        setLoading(false);
        Alert.alert(t("error") || "Rejected", data.error || "Invalid verification code.");
      }
    } catch (err) {
      setLoading(false); 
      console.error("❌ High-level OTP verification token save failure:", err);
      Alert.alert(t("error") || "Error", "Handshake processing drop out.");
    }
  };

  return (
    <KeyboardAvoidingView
       style={{ flex: 1, backgroundColor: '#FFFFFF' }}
       behavior={Platform.OS === "ios" ? "padding" : "height"}
       keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 0}
     >
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.container}>
          {/* DYNAMIC TYPOGRAPHY HEADER */}
         <View style={styles.header}>
  <Text
    style={[
      styles.brandTitle,
      { textAlign: 'center' }
    ]}
  >
    {t('brandGallery') || 'Brand Gallery'}
  </Text>

  <Text
    style={[
      styles.welcomeText,
     
    ]}
  >
    {locale === 'en'
      ? 'SECURE ACCESS GATE'
      : locale === 'fa'
      ? 'ورود به حساب کاربری'
      : 'خپل حساب ته ننوتل'}
  </Text>
</View>
          
          {/* SUBMISSION FORM LAYER */}
          <View style={styles.form}>
            {!isStepTwo ? (
              <View style={styles.inputWrapper}>
                <Text
  style={[
    styles.label,
  
  ]}
>
                  {t('phoneNumber') || "PHONE / EMAIL"}
                </Text>
                <TextInput 
                  placeholder="07XXXXXXXX" 
                  placeholderTextColor="#BBBBBB"
                  value={phone} 
                  onChangeText={setPhone} 
                  style={[
  styles.input,
  {
    textAlign: isRTL ? 'right' : 'left',
    writingDirection: isRTL ? 'rtl' : 'ltr',
  }
]}
                  keyboardType="phone-pad"
                  autoCapitalize="none"
                />
              </View>
            ) : (
              <View style={styles.formCardInputsContainer}>
                {/* 🎯 RE-BALANCED MINIMALIST CELL: Name text inputs removed completely! */}
                <View style={styles.inputWrapper}>
                  <Text
  style={[
    styles.label,
   
  ]}
>
                    {locale === 'en' ? "VERIFICATION CODE" : "کد تاییدیه"}
                  </Text>
                  <TextInput 
                    placeholder="••••••" 
                    placeholderTextColor="#BBBBBB"
                    value={code} 
                    onChangeText={setCode} 
                    style={[
  styles.input,
  {
    textAlign: isRTL ? 'right' : 'left',
    writingDirection: isRTL ? 'rtl' : 'ltr',
  }
]}
                    keyboardType="number-pad"
                    maxLength={6}
                  />
                </View>
              </View>
            )}

            {/* CHECKBOX AND SUBMIT BUTTON ELEMENTS RESEALED BELOW */}

      
            {/* 🎯 THE COMPLIANT CHECKBOX ROW ELEMENT STRIP LAYOUT */}
            <View style={[styles.checkboxContainer, isRTL && { flexDirection: "row-reverse" }]}>
              <TouchableOpacity 
                style={[styles.checkboxBox, isChecked && styles.checkboxBoxChecked]} 
                activeOpacity={0.8}
                onPress={() => setIsChecked(!isChecked)}
              >
                {isChecked && <Ionicons name="checkmark-sharp" size={11} color="#FFFFFF" />}
              </TouchableOpacity>
              
              <View style={[styles.legalTextWrapper, isRTL ? { paddingRight: 12, paddingLeft: 0 } : { paddingLeft: 12 }]}>
                <Text style={[styles.legalBaseText, isRTL ? { textAlign: "right" } : { textAlign: "left" }]}>
                  {locale === "en" ? "I explicitly accept and agree to the " : "من شرایط را می‌پذیرم و با "}
                  
                  <Text 
                    suppressHighlighting={true}
                    style={styles.legalLinkUnderline} 
                    onPress={() => {
                      console.log("🔗 Opening Terms View:", TERMS_URL);
                      handleOpenLink(TERMS_URL);
                    }}
                  >
                    {locale === "en" ? "Terms of Service" : "شرایط خدمات"}
                  </Text>

                  {locale === "en" ? " and " : " و "}
                  
                  <Text 
                    suppressHighlighting={true}
                    style={styles.legalLinkUnderline} 
                    onPress={() => {
                      console.log("🔗 Opening Privacy View:", PRIVACY_URL);
                      handleOpenLink(PRIVACY_URL);
                    }}
                  >
                    {locale === "en" ? "Privacy Policy" : "خط مشی رازداری"}
                  </Text>

                  {locale === "en" ? "." : " موافقت می‌کنم."}
                </Text>
              </View>
            </View>

            {/* PRIMARY ACTION BUTTON */}
            <TouchableOpacity
              style={[
                styles.primaryBtn,
                (!isChecked || loading) && styles.disabledBtnState
              ]}
              onPress={isStepTwo ? handleVerifyOTP : handleSendOTP}
              disabled={loading || !isChecked}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.primaryBtnText}>
                  {isStepTwo
                    ? (locale === 'en' ? "VERIFY CODE" : "تایید کد")
                    : (locale === 'en' ? "SEND VERIFICATION CODE" : "ارسال کد تایید")}
                </Text>
              )}
            </TouchableOpacity>

            {/* THE RE-LINK FIX: BACK TO PRIMARY SIGN-IN */}
            <TouchableOpacity 
              style={[styles.backLink, isRTL && { flexDirection: 'row-reverse' }]} 
              onPress={() => router.replace('/(auth)/sign-in')}
              activeOpacity={0.7}
            >
              <Ionicons name={isRTL ? "arrow-back-sharp" : "arrow-back-sharp"} size={14} color="#999999" />
              <Text style={styles.backLinkText}>
                {locale === 'en' ? "RETURN TO SIGN IN PORTAL" : "بازگشت به صفحه ورود اصلی"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}


const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
  },

  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 28,
    justifyContent: "center",
  },

  // =========================
  // HEADER / BRAND BLOCK
  // =========================
header: {
  marginBottom: 40,
  width: "100%",
},

 brandTitle: {
  width: "100%",
  fontSize: 30,
  fontWeight: "900",
  letterSpacing: 5,
  color: "#000000",
  marginBottom: 8,
  textAlign: "center",
},
welcomeText: {
  width: "100%",
  fontSize: 12,
  fontWeight: "900",
  color: "#000000",
  letterSpacing: 1.8,
  textTransform: "uppercase",
  textAlign: "center",
},
  subText: {
    fontSize: 12,
    color: "#777777",
    marginTop: 10,
    lineHeight: 18,
    fontWeight: "500",
  },

  // =========================
  // FORM WRAPPER (CARD FEEL)
  // =========================
  form: {
    width: "100%",
  },

  inputWrapper: {
    marginBottom: 22,
  },

  label: {
    fontSize: 9,
    fontWeight: "900",
    color: "#000000",
    letterSpacing: 1.4,
    marginBottom: 8,
    textTransform: "uppercase",
  },

  input: {
    borderBottomWidth: 1,
    borderBottomColor: "#EDEDED",
    paddingVertical: 12,
    fontSize: 16,
    color: "#000000",
    fontWeight: "700",
    letterSpacing: 0.5,
  },

  // =========================
  // OTP INPUT ROW (IMPORTANT)
  // =========================
  otpContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
    marginBottom: 20,
  },

  otpBox: {
    width: 48,
    height: 56,
    borderWidth: 1,
    borderColor: "#E6E6E6",
    borderRadius: 10,
    textAlign: "center",
    fontSize: 18,
    fontWeight: "900",
    color: "#000000",
    backgroundColor: "#FAFAFA",
  },

  otpBoxActive: {
    borderColor: "#000000",
    backgroundColor: "#FFFFFF",
  },

  // =========================
  // LEGAL CHECKBOX SECTION
  // =========================
  checkboxContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    width: "100%",
    marginTop: 10,
    marginBottom: 28,
  },

  checkboxBox: {
    width: 18,
    height: 18,
    borderWidth: 1.5,
    borderColor: "#000000",
    borderRadius: 3,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 2,
  },

  checkboxBoxChecked: {
    backgroundColor: "#000000",
  },

  legalTextWrapper: {
    flex: 1,
    paddingLeft: 10,
  },

  legalBaseText: {
    fontSize: 11,
    color: "#666666",
    lineHeight: 16,
    fontWeight: "500",
  },

  legalLinkUnderline: {
    color: "#000000",
    fontWeight: "900",
    textDecorationLine: "underline",
  },

  // =========================
  // PRIMARY BUTTON (STRONG CTA)
  // =========================
  primaryBtn: {
    backgroundColor: "#000000",
    paddingVertical: 18,
    alignItems: "center",
    borderRadius: 14,
    marginTop: 10,

    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 3,
  },

  disabledBtnState: {
    backgroundColor: "#EAEAEA",
    opacity: 0.7,
  },

  primaryBtnText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 13,
    letterSpacing: 2,
    textTransform: "uppercase",
  },

  // =========================
  // SECONDARY LINK
  // =========================
  backLink: {
    marginTop: 26,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },

  backLinkText: {
    color: "#999999",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
    textDecorationLine: "underline",
  },

  // =========================
  // LOADING / STATUS TEXT
  // =========================
  loadingText: {
    marginTop: 18,
    fontSize: 11,
    fontWeight: "700",
    color: "#888888",
    textAlign: "center",
  },

  errorText: {
    fontSize: 11,
    color: "#FF3B30",
    fontWeight: "700",
    marginTop: 10,
  },
});


import React, { useState } from "react"; 
import { 
  View, 
  TextInput, 
  TouchableOpacity, 
  Text, 
  StyleSheet, 
  ActivityIndicator, 
  ScrollView, 
  KeyboardAvoidingView, 
  Alert, 
  Platform 
} from "react-native";
import { authClient } from "@/lib/auth-client";
import { Link, useRouter } from "expo-router";
import { useLanguage } from "@/Contexts/LanguageContext";
import { Ionicons } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import { API_URL } from '@/lib/config';

export default function SignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  
  // 🎯 LEGAL COMPLIANCE STATE ENGINE
  const [isChecked, setIsChecked] = useState(false);
  
  const { t, isRTL, locale } = useLanguage();
  const router = useRouter();
const [showPassword, setShowPassword] = useState(false);
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
  // Inside app/(auth)/sign-in.tsx -> handleLogin function
  // Inside app/(auth)/sign-in.tsx -> handleLogin function core payload
   // 🎯 HIGH-PERFORMANCE LOW-LATENCY AUTODISPATCH LOGIN PIPELINE
  const handleLogin = async () => {
    if (!isChecked) {
      return Alert.alert(
        t("error") || "Agreement Required",
        locale === "en"
          ? "Accept the Terms and Privacy Policy to access your account."
          : "لطفاً ابتدا شرایط خدمات را تایید کنید."
      );
    }

    if (!email.trim() || !password.trim()) {
      return Alert.alert(
        t("error") || "Missing Fields",
        locale === "en"
          ? "Please enter email and password."
          : "ایمیل و رمز عبور را وارد کنید."
      );
    }

    setLoading(true);

    try {
      // Use centralized authClient to perform sign-in and emit session
      await authClient.signInDirect(email.trim().toLowerCase(), password.trim());

      // Redirect on success (authClient emits session internally)
      router.replace('/');
      return;
    } catch (err: any) {
      console.error('❌ Sign-in failed:', err);
      Alert.alert(t('error') || 'Authentication Failed', err?.message || 'Invalid email or password.');
      setLoading(false);
    }
  };



  return (
    <KeyboardAvoidingView
      style={styles.keyboardContainer}
      behavior={Platform.OS === "ios" ? "padding" : "padding"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 30}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.innerView}>

          {/* HEADER */}
         <View style={styles.header}>
            <Text style={styles.brandTitle}>
  {t("brandGallery")}
</Text>

<Text
  style={[
    styles.welcomeText,
    { textAlign: isRTL ? "center" : "center" }
  ]}
>
  {(t("welcomeBack") || "WELCOME BACK").toUpperCase()}
</Text>
          </View>

          {/* FORM */}
          <View style={styles.form}>
            
            {/* EMAIL */}
            <View style={styles.inputWrapper}>
              <Text style={[styles.label]}>
                {(t("email") || "EMAIL ADDRESS").toUpperCase()}
              </Text>
              <TextInput
                style={[styles.input, isRTL ? { textAlign: "right", direction: "rtl" } : { textAlign: "left", direction: "ltr" }]}
                placeholder={t("enterEmailPlaceholder") || "ENTER YOUR EMAIL"}
                placeholderTextColor="#BBB"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                returnKeyType="next"
              />
            </View>

            {/* PASSWORD */}
           {/* PASSWORD */}
<View style={styles.inputWrapper}>
  <Text style={[styles.label]}>
    {(t("password") || "PASSWORD").toUpperCase()}
  </Text>

  <View style={styles.passwordContainer}>
    <TextInput
      style={[
        styles.passwordInput,
        isRTL
          ? { textAlign: "right", direction: "rtl" }
          : { textAlign: "left", direction: "ltr" },
      ]}
      placeholder={t("passwordPlaceholder") || "ENTER YOUR PASSWORD"}
      placeholderTextColor="#BBB"
      value={password}
      onChangeText={setPassword}
      secureTextEntry={!showPassword}
      returnKeyType="done"
    />

    <TouchableOpacity
      onPress={() => setShowPassword((prev) => !prev)}
      style={styles.eyeButton}
      activeOpacity={0.7}
    >
      <Ionicons
            name={showPassword ? "eye-off-outline" : "eye-outline"}
            size={22}
            color="#666"
          />
    </TouchableOpacity>
  </View>

  <Link href="/otp-login" asChild>
    <TouchableOpacity
      style={[
        styles.forgotBtn,
        isRTL
          ? { alignSelf: "flex-start" }
          : { alignSelf: "flex-end" },
      ]}
      activeOpacity={0.7}
    >
      <Text style={styles.forgotText}>
        {t("forgotPassword") || "Forgot Password?"}
      </Text>
    </TouchableOpacity>
  </Link>
</View>
            {/* 🎯 THE COMPLIANT CHECKBOX ROW ELEMENT STRIP LAYOUT */}
                       {/* 🎯 THE ACCURATE LEGAL COMPLIANCE ELEMENT LABELS STRUCTURE */}
            <View style={[styles.checkboxContainer, isRTL && { flexDirection: "row-reverse" }]}>
              <TouchableOpacity 
                style={[styles.checkboxBox, isChecked && styles.checkboxBoxChecked]} 
                activeOpacity={0.8}
                onPress={() => setIsChecked(!isChecked)}
              >
                {isChecked && <Ionicons name="checkmark-sharp" size={11} color="#FFFFFF" />}
              </TouchableOpacity>
              
              <View style={[styles.legalTextWrapper, isRTL ? { paddingRight: 12, paddingLeft: 0 } : { paddingLeft: 12 }]}>
                {/* 🎯 THE TOUCH-ISOLATION FIX: Splitting text triggers outside raw text blocks using multi-line paragraph wrappers */}
                <Text style={[styles.legalBaseText, isRTL ? { textAlign: "right" } : { textAlign: "left" }]}>
                  {locale === "en" ? "I explicitly accept and agree to the " : "من شرایط را می‌پذیرم و با "}
                  
                  {/* TERMS LINK BUTTON */}
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
                  
                  {/* PRIVACY LINK BUTTON */}
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

            {/* SIGN IN BUTTON */}
            {/* 🎯 DISABLED MATRICES STATE TRIGGER: Blends styling dynamically based on checkbox weight */}
            <TouchableOpacity
              style={[
                styles.signInBtn,
                (!isChecked || loading) && styles.disabledSignInBtnState
              ]}
              onPress={handleLogin}
              disabled={loading || !isChecked}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.signInBtnText}>
                  {(t("signIn") || "SIGN IN").toUpperCase()}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.guestButton}
              onPress={async () => {
                await authClient.continueAsGuest();
                router.replace('/(shop)');
              }}
            >
              <Text style={styles.guestButtonText}>
                {t("continueAsGuest") || "Continue as Guest"}
              </Text>
            </TouchableOpacity>
          </View>


          {/* FOOTER */}
        <View
  style={[
    styles.footer,
    {
      justifyContent: "center",
      flexDirection: isRTL ? "row-reverse" : "row",
    },
  ]}
>
            <Text style={styles.footerText}>
              {t("newToBrandGallery")}
            </Text>
            <Link href="/sign-up" asChild>
              <TouchableOpacity activeOpacity={0.7}>
                <Text style={[styles.signUpLink, isRTL ? { marginRight: 4, marginLeft: 0 } : { marginLeft: 4 }]}>
                  {t("registerNow")}
                </Text>
              </TouchableOpacity>
            </Link>
          </View>

        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
const styles = StyleSheet.create({
  // =========================
  // ROOT CONTAINERS (MODERN APP SHELL)
  // =========================
  keyboardContainer: {
    flex: 1,
    backgroundColor: "#FAFAFA",
  },

  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },

  innerView: {
    width: "100%",
  },

  // =========================
  // HEADER (PREMIUM BRAND BLOCK)
  // =========================
  header: {
    alignItems: "center",
    marginBottom: 42,
  },

  brandTitle: {
    fontSize: 30,
    fontWeight: "900",
    color: "#0B0B0B",
    letterSpacing: 1.5,
    textAlign: "center",
  },

  welcomeText: {
    marginTop: 10,
    fontSize: 12,
    fontWeight: "600",
    color: "#7A7A7A",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    textAlign: "center",
  },

  // =========================
  // FORM WRAPPER (CARD STYLE)
  // =========================
  form: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 18,

    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.06,
    shadowRadius: 18,
    elevation: 3,
  },

  inputWrapper: {
    marginBottom: 18,
  },

  label: {
    fontSize: 10,
    fontWeight: "800",
    color: "#111",
    letterSpacing: 1.6,
    marginBottom: 8,
    textTransform: "uppercase",
  },
  guestButton: {
  marginTop: 14,
  paddingVertical: 15,
  borderRadius: 14,
  borderWidth: 1,
  borderColor: "#DDD",
  alignItems: "center",
},

guestButtonText: {
  fontSize: 13,
  fontWeight: "800",
  color: "#222",
  letterSpacing: 1,
},

  // =========================
  // INPUT (MODERN SOFT FIELD)
  // =========================
  input: {
    backgroundColor: "#F7F7F8",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,

    fontSize: 15,
    fontWeight: "600",
    color: "#111",

    borderWidth: 1,
    borderColor: "#EFEFEF",
  },

  inputFocused: {
    borderColor: "#000",
    backgroundColor: "#FFFFFF",
  },

  // =========================
  // PASSWORD FIELD (MODERN ROW INPUT)
  // =========================
  passwordContainer: {
    flexDirection: "row",
    alignItems: "center",

    backgroundColor: "#F7F7F8",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#EFEFEF",
  },

  passwordInput: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 15,
    fontWeight: "600",
    color: "#111",
  },

  eyeButton: {
    paddingHorizontal: 14,
    justifyContent: "center",
    alignItems: "center",
  },

  eyeText: {
    fontSize: 18,
    color: "#333",
  },

  // =========================
  // FORGOT PASSWORD (MINIMAL LINK)
  // =========================
  forgotBtn: {
    marginTop: 10,
    alignSelf: "flex-end",
  },

  forgotText: {
    fontSize: 12,
    color: "#555",
    fontWeight: "600",
  },

  // =========================
  // LEGAL CHECKBOX (CLEAN ALIGNMENT)
  // =========================
  checkboxContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: 18,
    marginBottom: 20,
  },

  checkboxBox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: "#111",
    justifyContent: "center",
    alignItems: "center",
  },

  checkboxBoxChecked: {
    backgroundColor: "#111",
  },

  legalTextWrapper: {
    flex: 1,
    paddingLeft: 10,
  },

  legalBaseText: {
    fontSize: 12,
    color: "#666",
    lineHeight: 18,
  },

  legalLinkUnderline: {
    color: "#000",
    fontWeight: "700",
    textDecorationLine: "underline",
  },

  // =========================
  // PRIMARY CTA (PREMIUM BUTTON)
  // =========================
  signInBtn: {
    backgroundColor: "#0B0B0B",
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",

    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 14,
    elevation: 4,
  },

  disabledSignInBtnState: {
    backgroundColor: "#DADADA",
  },

  signInBtnText: {
    color: "#FFFFFF",
    fontWeight: "900",
    letterSpacing: 2,
    fontSize: 13,
    textTransform: "uppercase",
  },

  // =========================
  // FOOTER (CLEAN + MODERN)
  // =========================
  footer: {
    marginTop: 30,
    alignItems: "center",
  },

  footerText: {
    fontSize: 12,
    color: "#888",
    fontWeight: "500",
  },

  signUpLink: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: "800",
    color: "#000",
    textDecorationLine: "underline",
  },
});
import React, { useState } from "react";
import { 
  View, 
  ScrollView, 
  TextInput, 
  StyleSheet, 
  Text, 
  ActivityIndicator, 
  TouchableOpacity, 
  Alert, 
  KeyboardAvoidingView, 
  Platform 
} from "react-native";
import { Link, useRouter } from "expo-router";
import { authClient } from '@/lib/auth-client';
import { useLanguage } from "@/Contexts/LanguageContext";
import { Ionicons } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import { API_URL } from '@/lib/config';

export default function SignUp() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState(""); 
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  // 🎯 LEGAL COMPLIANCE STATE ENGINE
  const [isChecked, setIsChecked] = useState(false);
  
  const { t, isRTL, locale } = useLanguage();
  const router = useRouter();

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

  // Inside app/(auth)/sign-up.tsx -> handleSignUp function core payload
const handleSignUp = async () => {
  if (!isChecked) {
    return Alert.alert(
      t("error") || "Agreement Required",
      "Accept the Terms and Privacy Policy to register."
    );
  }

  const cleanEmail = email.trim().toLowerCase();
  const cleanName = name.trim();
  const cleanPhone = phone.trim();
  const cleanPassword = password.trim();

  // BASIC MVP VALIDATION
  if (!cleanName || !cleanEmail || !cleanPassword) {
    return Alert.alert(
      t("error") || "Error",
      "Please fill all required fields."
    );
  }

  // LIGHT EMAIL VALIDATION
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailRegex.test(cleanEmail)) {
    return Alert.alert(
      t("error") || "Invalid Email",
      "Please enter a valid email address."
    );
  }

  // SIMPLE PASSWORD SECURITY
  if (cleanPassword.length < 6) {
    return Alert.alert(
      t("error") || "Weak Password",
      "Password must be at least 6 characters."
    );
  }

  setLoading(true);

  try {
    // Use centralized auth client to sign up and emit session
    await authClient.signUpDirect({
      email: cleanEmail,
      password: cleanPassword,
      name: cleanName,
      phone: cleanPhone || undefined,
    });

    router.replace('/');
    return;
  } catch (err: any) {
    console.error('❌ Registration failed:', err);
    Alert.alert(t('error') || 'Registration Failed', err?.message || 'Could not create account.');
  } finally {
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
  <Text
    style={[
      styles.brandTitle,
      {
        textAlign: "center",
      },
    ]}
  >
    {t("brandGallery") || "Brand Gallery"}
  </Text>

  <Text
    style={[
      styles.subText,
    
    ]}
  >
    {t("signUpSubtitle") ||
      (locale === "en"
        ? "Fill in your profile credentials to access the directory store."
        : "اطلاعات کاربری خود را جهت ساخت حساب وارد نمایید.")}
  </Text>
</View>

          {/* FORM */}
          <View style={styles.form}>

            {/* NAME */}
            <View style={styles.inputWrapper}>
              <Text style={[styles.label]}>
                {(t("fullName") || "FULL NAME").toUpperCase()}
              </Text>
              <TextInput
                style={[
  styles.input,
  {
    textAlign: isRTL ? "right" : "left",
    writingDirection: isRTL ? "rtl" : "ltr",
  },
]}
                placeholder={t("enterNamePlaceholder") || "ENTER YOUR NAME"}
                placeholderTextColor="#BBB"
                value={name}
                onChangeText={setName}
                returnKeyType="next"
              />
            </View>

            {/* EMAIL */}
            <View style={styles.inputWrapper}>
              <Text style={[styles.label]}>
                {(t("email") || "EMAIL ADDRESS").toUpperCase()}
              </Text>
              <TextInput
             style={[
  styles.input,
  {
    textAlign: isRTL ? "right" : "left",
    writingDirection: isRTL ? "rtl" : "ltr",
  },
]}
  placeholder={t("enterEmailPlaceholder") || "ENTER YOUR EMAIL"}
                placeholderTextColor="#BBB"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                returnKeyType="next"
              />
            </View>

            {/* PHONE */}
            <View style={styles.inputWrapper}>
              <Text style={[styles.label]}>
                {(t("phoneNumber") || "PHONE NUMBER").toUpperCase()}
              </Text>
              <TextInput
               style={[
  styles.input,
  {
    textAlign: isRTL ? "right" : "left",
    writingDirection: isRTL ? "rtl" : "ltr",
  },
]}
placeholder={t("phonePlaceholder") || "ENTER YOUR PHONE NUMBER"}
                placeholderTextColor="#BBB"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                returnKeyType="next"
              />
            </View>

            {/* PASSWORD */}
           <View style={styles.inputWrapper}>
  <Text style={[styles.label]}>
    {(t("password") || "PASSWORD").toUpperCase()}
  </Text>

  <View style={styles.passwordContainer}>
    <TextInput
      style={[styles.passwordInput]}
      placeholder={t("passwordPlaceholder") || "ENTER YOUR PASSWORD"}
      placeholderTextColor="#BBB"
      value={password}
      onChangeText={setPassword}
      secureTextEntry={!showPassword}
      returnKeyType="done"
    />

    <TouchableOpacity
      onPress={() => setShowPassword(!showPassword)}
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


            {/* REGISTER BUTTON */}
            {/* 🎯 DISABLED MATRICES STATE TRIGGER */}
            <TouchableOpacity
              style={[
                styles.signUpBtn,
                (!isChecked || loading) && styles.disabledSignUpBtnState
              ]}
              onPress={handleSignUp}
              disabled={loading || !isChecked}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.signUpBtnText}>
                  {(t("register") || "REGISTER").toUpperCase()}
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
          <View style={[styles.footer, isRTL && { flexDirection: "row-reverse" }]}>
            <Text style={styles.footerText}>
              {t("alreadyHaveAccount") || "Already have an account?"}
            </Text>
            <Link href="/sign-in" asChild>
              <TouchableOpacity activeOpacity={0.7}>
                <Text style={[styles.signInLink, isRTL ? { marginRight: 4, marginLeft: 0 } : { marginLeft: 4 }]}>
                  {t("signIn") || "Sign In"}
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
  // ROOT CONTAINERS (MODERN BASE)
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
  // HEADER (PREMIUM BRAND STYLE)
  // =========================
  header: {
    marginBottom: 42,
    alignItems: "center",
  },

  brandTitle: {
    fontSize: 30,
    fontWeight: "900",
    color: "#0B0B0B",
    letterSpacing: 2,
    textAlign: "center",
  },

  welcomeText: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.4,
    color: "#666",
    textTransform: "uppercase",
    textAlign: "center",
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
  subText: {
    fontSize: 12,
    textAlign: "center",
    color: "#777",
    marginTop: 10,
    lineHeight: 18,
    fontWeight: "500",
    paddingHorizontal: 10,
  },

  // =========================
  // FORM CARD (CLEAN MODERN BLOCK)
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

  // =========================
  // INPUT (SOFT MODERN FIELD)
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
  // PASSWORD FIELD
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
  // LEGAL CHECKBOX (MODERN ALIGNMENT)
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
  // PRIMARY BUTTON (PREMIUM CTA)
  // =========================
  signUpBtn: {
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

  disabledSignUpBtnState: {
    backgroundColor: "#DADADA",
  },

  signUpBtnText: {
    color: "#FFFFFF",
    fontWeight: "900",
    letterSpacing: 2,
    fontSize: 13,
    textTransform: "uppercase",
  },

  // =========================
  // FOOTER (CLEAN NAV LINK)
  // =========================
  footer: {
    marginTop: 28,
    alignItems: "center",
  },

  footerText: {
    fontSize: 12,
    color: "#888",
    fontWeight: "500",
  },

  signInLink: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: "800",
    color: "#000",
    textDecorationLine: "underline",
  },
});
import { View, Text, StyleSheet, Switch, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { authClient } from '../lib/auth-client';
import { useRouter } from 'expo-router';
import { useState } from 'react';

export default function SettingsPage() {
  const router = useRouter();
  const { data: session } = authClient.useSession();
 const [name, setName] = useState(session?.user?.name || '');
  const [email, setEmail] = useState(session?.user?.email || '');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);

  const handleUpdate = async () => {
    setLoading(true);
    try {
      // Placeholder save handler — implement API call if desired
      await Promise.resolve();
      Alert.alert('Saved', 'Profile save is not implemented in this build.');
    } catch (e) {
      Alert.alert('Error', 'Failed to save profile.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await authClient.signOut();
    router.replace('/sign-in');
  };

return (
  <ScrollView style={styles.container} contentContainerStyle={styles.content}>
    {/* SHEIN STYLE HEADER */}
    <View style={styles.header}>
      <TouchableOpacity onPress={() => router.back()} style={styles.headerIcon}>
        <Ionicons name="chevron-back" size={24} color="#000" />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>PERSONAL INFORMATION</Text>
      <TouchableOpacity onPress={handleUpdate} disabled={loading} style={styles.headerIcon}>
        {loading ? <ActivityIndicator size="small" color="#000" /> : <Text style={styles.saveBtn}>SAVE</Text>}
      </TouchableOpacity>
    </View>

    {/* PROFILE IMAGE SECTION */}
    <View style={styles.avatarSection}>
      <View style={styles.avatarWrapper}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarText}>{name[0]?.toUpperCase()}</Text>
        </View>
        <TouchableOpacity style={styles.cameraIcon}>
          <Ionicons name="camera" size={16} color="#FFF" />
        </TouchableOpacity>
      </View>
      <Text style={styles.userName}>{name.toUpperCase()}</Text>
    </View>

    {/* MINIMALIST FORM */}
    <View style={styles.form}>
      <View style={styles.inputBox}>
        <Text style={styles.label}>FULL NAME</Text>
        <TextInput 
          style={styles.input} 
          value={name} 
          onChangeText={setName} 
          placeholder="Enter your name"
          placeholderTextColor="#BBB"
        />
      </View>

      <View style={styles.inputBox}>
        <Text style={styles.label}>EMAIL ADDRESS</Text>
        <TextInput 
          style={[styles.input, { color: '#AAA' }]} 
          value={email} 
          editable={false} 
        />
        <Ionicons name="lock-closed-outline" size={14} color="#CCC" style={styles.lockIcon} />
      </View>

      <View style={styles.inputBox}>
        <Text style={styles.label}>PHONE NUMBER</Text>
        <TextInput 
          style={styles.input} 
          value={phone} 
          onChangeText={setPhone} 
          placeholder="+93 7xx xxx xxx"
          keyboardType="phone-pad"
        />
      </View>
    </View>

    {/* LOGOUT - Minimalist Footer Link */}
    <TouchableOpacity 
      style={styles.logoutWrapper} 
      onPress={() => authClient.signOut().then(() => router.replace('/sign-in'))}
    >
      <Text style={styles.logoutText}>SIGN OUT OF ACCOUNT</Text>
    </TouchableOpacity>
  </ScrollView>
);
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  content: { paddingBottom: 60 },
  
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingHorizontal: 16, 
    paddingTop: 60, 
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5'
  },
  headerIcon: { width: 50 },
  headerTitle: { fontSize: 13, fontWeight: '800', letterSpacing: 1.5, color: '#000' },
  saveBtn: { fontSize: 12, fontWeight: '800', color: '#000', textAlign: 'right' },
  
  avatarSection: { alignItems: 'center', marginTop: 40, marginBottom: 30 },
  avatarWrapper: { position: 'relative' },
  avatarCircle: { 
    width: 90, 
    height: 90, 
    borderRadius: 45, 
    backgroundColor: '#F9F9F9', 
    justifyContent: 'center', 
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F0F0F0'
  },
  avatarText: { fontSize: 32, fontWeight: '300', color: '#000' },
  cameraIcon: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#000',
    padding: 8,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#FFF'
  },
  userName: { marginTop: 15, fontSize: 14, fontWeight: '700', letterSpacing: 1 },

  form: { paddingHorizontal: 25 },
  inputBox: { 
    marginBottom: 30, 
    borderBottomWidth: 1, 
    borderBottomColor: '#EEEEEE',
    position: 'relative' 
  },
  label: { 
    fontSize: 10, 
    fontWeight: '800', 
    color: '#999', 
    letterSpacing: 1,
    marginBottom: 5 
  },
  input: { 
    paddingVertical: 12, 
    fontSize: 15, 
    color: '#000',
    fontWeight: '500' 
  },
  lockIcon: { position: 'absolute', right: 0, bottom: 15 },

  logoutWrapper: { 
    marginTop: 40, 
    alignItems: 'center',
    paddingVertical: 20
  },
  logoutText: { 
    fontSize: 11, 
    fontWeight: '800', 
    color: '#999', 
    letterSpacing: 2,
    textDecorationLine: 'underline' 
  }
});

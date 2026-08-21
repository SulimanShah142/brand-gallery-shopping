import { useEffect, useState } from "react";

export function useProfileState(sessionData: any) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [displayEmail, setDisplayEmail] = useState('');

  useEffect(() => {
    const user = sessionData?.user;
    if (!user) return;

    let resolvedPhone =
      user?.phoneNumber ||
      user?.phone ||
      '';

    const email = user?.email || '';

    // fallback extraction (your smart logic preserved)
    if (!resolvedPhone && email.includes('@phone.local')) {
      resolvedPhone = email.split('@')[0];
    }

    setName(user?.name || user?.customerName || '');
    setPhone(resolvedPhone.replace(/\s/g, ''));
    setDisplayEmail(email.toLowerCase());
  }, [sessionData]);

  return {
    name,
    setName,
    phone,
    setPhone,
    displayEmail,
  };
}
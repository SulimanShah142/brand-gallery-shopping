// lib/geocoding.ts
const LOCATIONIQ_KEY = process.env.EXPO_PUBLIC_LOCATION_IQ_TOKEN

export const reverseGeocode = async (lat: number, lng: number) => {
  try {
    const res = await fetch(
      `https://locationiq.com{LOCATIONIQ_KEY}&lat=${lat}&lon=${lng}&format=json`
    );
    const data = await res.json();
    return data.display_name; // Returns the full readable address
  } catch (e) {
    return "Unknown Location";
  }
};

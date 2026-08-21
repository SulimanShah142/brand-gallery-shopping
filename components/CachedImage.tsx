import React, { useEffect, useState } from 'react';
import { Image, ImageStyle, StyleProp } from 'react-native';
import { getCachedImageUri } from '../lib/offline'; // Use relative path to be safe

interface CachedImageProps {
  remoteUrl?: string;    // Changed from sourceUri to match your Page usage
  fallbackUri?: string;
  style?: StyleProp<ImageStyle>;
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'repeat' | 'center';
}

export default function CachedImage({
  remoteUrl,
  fallbackUri = 'https://placehold.co',
  style,
  resizeMode = 'cover',
}: CachedImageProps) {
  const [uri, setUri] = useState<string>(fallbackUri);

  useEffect(() => {
    let mounted = true;

    async function resolveUri() {
      if (!remoteUrl) {
        setUri(fallbackUri);
        return;
      }

      try {
        const resolved = await getCachedImageUri(remoteUrl, fallbackUri);
        if (mounted) setUri(resolved);
      } catch (e) {
        if (mounted) setUri(fallbackUri);
      }
    }

    resolveUri();

    return () => {
      mounted = false;
    };
  }, [remoteUrl, fallbackUri]);

  return (
    <Image 
      source={{ uri }} 
      style={style} 
      resizeMode={resizeMode} 
    />
  );
}

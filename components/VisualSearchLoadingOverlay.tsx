import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  StyleSheet,
  Text,
  View,
} from 'react-native';

type Props = {
  visible: boolean;
  imageUri?: string | null;
  progress?: number;
  stage?: 'preparing' | 'analyzing' | 'searching' | 'finishing';
  locale?: string;
  dark?: boolean;
};

export default function VisualSearchLoadingOverlay({
  visible,
  imageUri,
  progress = 0,
  stage = 'searching',
  locale = 'en',
  dark = false,
}: Props) {
  const scanPosition = useRef(new Animated.Value(0)).current;
  const glowOpacity = useRef(new Animated.Value(0.35)).current;
  const progressValue = useRef(new Animated.Value(0)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const contentScale = useRef(new Animated.Value(0.96)).current;

  const [displayProgress, setDisplayProgress] = useState(2);

  useEffect(() => {
    if (!visible) {
      scanPosition.stopAnimation();
      glowOpacity.stopAnimation();
      progressValue.stopAnimation();
      contentOpacity.stopAnimation();
      contentScale.stopAnimation();

      setDisplayProgress(2);
      return;
    }

    contentOpacity.setValue(0);
    contentScale.setValue(0.96);

    Animated.parallel([
      Animated.timing(contentOpacity, {
        toValue: 1,
        duration: 350,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(contentScale, {
        toValue: 1,
        damping: 18,
        stiffness: 180,
        mass: 0.8,
        useNativeDriver: true,
      }),
    ]).start();
  }, [
    visible,
    contentOpacity,
    contentScale,
    scanPosition,
    glowOpacity,
    progressValue,
  ]);

  useEffect(() => {
    if (!visible) return;

    scanPosition.setValue(0);

    const scanLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(scanPosition, {
          toValue: 1,
          duration: 1800,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(scanPosition, {
          toValue: 0,
          duration: 1800,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );

    scanLoop.start();

    return () => scanLoop.stop();
  }, [visible, scanPosition]);

  useEffect(() => {
    if (!visible) return;

    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(glowOpacity, {
          toValue: 0.75,
          duration: 900,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(glowOpacity, {
          toValue: 0.25,
          duration: 900,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    glowLoop.start();

    return () => glowLoop.stop();
  }, [visible, glowOpacity]);

  useEffect(() => {
    progressValue.stopAnimation();

    Animated.timing(progressValue, {
      toValue: Math.max(0, Math.min(progress, 100)),
      duration: 450,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();

    const target = Math.max(
      2,
      Math.min(
        96,
        stage === 'searching'
          ? Math.max(8, Math.round(progress * 0.88))
          : Math.round(progress * 0.78)
      )
    );

    const timer = setInterval(() => {
      setDisplayProgress((current) => {
        if (current >= target) return current;

        return Math.min(
          target,
          current + Math.max(1, Math.ceil((target - current) / 6))
        );
      });
    }, 70);

    return () => clearInterval(timer);
  }, [progress, stage, progressValue]);

  if (!visible) return null;

  const copy =
    locale === 'ps'
      ? {
          title: 'ستاسو لپاره ورته محصولات پیدا کوو',
          preparing: 'عکس چمتو کېږي',
          analyzing: 'عکس تحلیل کېږي',
          searching: 'ورته محصولات لټول کېږي',
          finishing: 'پایلې چمتو کېږي',
          percent: 'بشپړ',
        }
      : locale === 'fa'
        ? {
            title: 'محصولات مشابه برای شما پیدا می‌کنیم',
            preparing: 'تصویر آماده می‌شود',
            analyzing: 'تصویر تحلیل می‌شود',
            searching: 'محصولات مشابه جستجو می‌شوند',
            finishing: 'نتایج آماده می‌شوند',
            percent: 'تکمیل',
          }
        : {
            title: 'Finding your perfect match',
            preparing: 'Preparing your image',
            analyzing: 'Understanding your style',
            searching: 'Finding similar products',
            finishing: 'Curating your results',
            percent: 'COMPLETE',
          };

  const subtitle =
    stage === 'preparing'
      ? copy.preparing
      : stage === 'analyzing'
        ? copy.analyzing
        : stage === 'finishing'
          ? copy.finishing
          : copy.searching;

  const foreground = dark ? '#FFFFFF' : '#111111';
  const muted = dark ? 'rgba(255,255,255,0.58)' : 'rgba(17,17,17,0.55)';
  const background = dark ? '#080808' : '#FAFAFA';
  const frameBackground = dark ? '#151515' : '#F1F1F1';
  const lineColor = dark ? '#FFFFFF' : '#111111';
  const softLine = dark
    ? 'rgba(255,255,255,0.18)'
    : 'rgba(17,17,17,0.12)';

  const scanTranslate = scanPosition.interpolate({
    inputRange: [0, 1],
    outputRange: [-8, 288],
  });

  return (
    <View
      style={[
        styles.overlay,
        {
          backgroundColor: background,
        },
      ]}
      pointerEvents="auto"
    >
      <Animated.View
        style={[
          styles.content,
          {
            opacity: contentOpacity,
            transform: [{ scale: contentScale }],
          },
        ]}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View
              style={[
                styles.liveDot,
                {
                  backgroundColor: foreground,
                },
              ]}
            />

            <Text
              style={[
                styles.headerLabel,
                {
                  color: foreground,
                },
              ]}
            >
              VISUAL SEARCH
            </Text>
          </View>

          <Text
            style={[
              styles.headerProgress,
              {
                color: muted,
              },
            ]}
          >
            {String(displayProgress).padStart(2, '0')}%
          </Text>
        </View>

        {/* Image */}
        <View
          style={[
            styles.imageFrame,
            {
              backgroundColor: frameBackground,
            },
          ]}
        >
          {imageUri ? (
            <Image
              source={{ uri: imageUri }}
              style={styles.image}
              resizeMode="cover"
            />
          ) : (
            <View
              style={[
                styles.imagePlaceholder,
                {
                  backgroundColor: frameBackground,
                },
              ]}
            />
          )}

          {/* Dark cinematic gradient */}
          <View style={styles.imageShade} />

          {/* Scanning glow */}
          <Animated.View
            style={[
              styles.scanGlow,
              {
                opacity: glowOpacity,
                transform: [{ translateY: scanTranslate }],
              },
            ]}
          />

          {/* Scanner line */}
          <Animated.View
            style={[
              styles.scanLine,
              {
                backgroundColor: lineColor,
                transform: [{ translateY: scanTranslate }],
              },
            ]}
          />

          {/* Scanner corners */}
          <View
            style={[
              styles.corner,
              styles.topLeft,
              { borderColor: lineColor },
            ]}
          />

          <View
            style={[
              styles.corner,
              styles.topRight,
              { borderColor: lineColor },
            ]}
          />

          <View
            style={[
              styles.corner,
              styles.bottomLeft,
              { borderColor: lineColor },
            ]}
          />

          <View
            style={[
              styles.corner,
              styles.bottomRight,
              { borderColor: lineColor },
            ]}
          />

          {/* Floating stage */}
          <View style={styles.stagePill}>
            <View
              style={[
                styles.stageDot,
                {
                  backgroundColor: lineColor,
                },
              ]}
            />

            <Text style={styles.stageText}>{subtitle}</Text>
          </View>
        </View>

        {/* Progress */}
        <View style={styles.progressSection}>
          <View
            style={[
              styles.progressTrack,
              {
                backgroundColor: softLine,
              },
            ]}
          >
            <Animated.View
              style={[
                styles.progressFill,
                {
                  width: progressValue.interpolate({
                    inputRange: [0, 100],
                    outputRange: ['0%', '100%'],
                  }),
                  backgroundColor: foreground,
                },
              ]}
            />
          </View>
        </View>

        {/* Main copy */}
        <Text
          style={[
            styles.title,
            {
              color: foreground,
            },
          ]}
        >
          {copy.title}
        </Text>

        <Text
          style={[
            styles.subtitle,
            {
              color: muted,
            },
          ]}
        >
          {subtitle}
        </Text>

        {/* Bottom status */}
        <View
          style={[
            styles.bottomRow,
            {
              borderTopColor: softLine,
            },
          ]}
        >
          <Text
            style={[
              styles.bottomLabel,
              {
                color: muted,
              },
            ]}
          >
            {copy.percent}
          </Text>

          <View style={styles.progressNumberRow}>
            <Text
              style={[
                styles.progressNumber,
                {
                  color: foreground,
                },
              ]}
            >
              {displayProgress}
            </Text>

            <Text
              style={[
                styles.progressSymbol,
                {
                  color: muted,
                },
              ]}
            >
              %
            </Text>
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
  },

  content: {
    width: '100%',
    maxWidth: 430,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },

  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 7,
    marginRight: 8,
  },

  headerLabel: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 2.1,
  },

  headerProgress: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },

  imageFrame: {
    width: '100%',
    height: 390,
    borderRadius: 4,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },

  image: {
    width: '100%',
    height: '100%',
  },

  imagePlaceholder: {
    width: '100%',
    height: '100%',
  },

  imageShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.08)',
  },

  scanGlow: {
    position: 'absolute',
    left: -20,
    right: -20,
    height: 80,
    backgroundColor: '#FFFFFF',
    opacity: 0.35,
  },

  scanLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1.5,
    opacity: 0.95,
  },

  corner: {
    position: 'absolute',
    width: 30,
    height: 30,
  },

  topLeft: {
    top: 18,
    left: 18,
    borderTopWidth: 1.5,
    borderLeftWidth: 1.5,
  },

  topRight: {
    top: 18,
    right: 18,
    borderTopWidth: 1.5,
    borderRightWidth: 1.5,
  },

  bottomLeft: {
    bottom: 18,
    left: 18,
    borderBottomWidth: 1.5,
    borderLeftWidth: 1.5,
  },

  bottomRight: {
    bottom: 18,
    right: 18,
    borderBottomWidth: 1.5,
    borderRightWidth: 1.5,
  },

  stagePill: {
    position: 'absolute',
    bottom: 18,
    left: 18,
    right: 18,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.58)',
  },

  stageDot: {
    width: 5,
    height: 5,
    borderRadius: 5,
    marginRight: 8,
  },

  stageText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.2,
  },

  progressSection: {
    marginTop: 18,
  },

  progressTrack: {
    height: 2,
    width: '100%',
    overflow: 'hidden',
  },

  progressFill: {
    height: '100%',
  },

  title: {
    marginTop: 22,
    fontSize: 22,
    lineHeight: 27,
    fontWeight: '800',
    letterSpacing: -0.5,
  },

  subtitle: {
    marginTop: 7,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '500',
  },

  bottomRow: {
    marginTop: 25,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  bottomLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.8,
  },

  progressNumberRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },

  progressNumber: {
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: -0.5,
  },

  progressSymbol: {
    marginLeft: 2,
    fontSize: 10,
    fontWeight: '700',
  },
});


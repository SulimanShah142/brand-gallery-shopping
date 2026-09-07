import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useRef, useEffect, useState } from 'react';
import { View, StyleSheet, ActivityIndicator, Platform, TouchableOpacity, Dimensions } from 'react-native';
import { WebView } from 'react-native-webview';

type UnifiedMapProps = {
  role: 'USER' | 'DELIVER' | 'ADMIN';
  warehouseCoords: [number, number];
  destinationCoords: [number, number];
  driverCoords: [number, number] | null; 
  orderStatus?: string;
  orderId?: string;
  showMarkers?: boolean;
  isFullscreen?: boolean;
  setIsFullscreen?: (value: boolean) => void;
};

export default function UnifiedMap({
  role,
  warehouseCoords,
  destinationCoords,
  driverCoords,
  orderStatus = 'confirmed',
  orderId,
  showMarkers = true,
  isFullscreen = false,
  setIsFullscreen
}: UnifiedMapProps) {
  const webViewRef = useRef<WebView>(null);
  const [loading, setLoading] = useState(true);
  const [internalFullscreen, setInternalFullscreen] = useState(false);
  const hasExternalFullscreenControl = typeof setIsFullscreen === 'function';
  const activeFullscreen = hasExternalFullscreenControl ? isFullscreen : internalFullscreen;

  // 1. EXTRACT EXPLICIT COORDINATES WITH STABLE DEFAULT FALLBACKS
  const whLat = warehouseCoords[0];
  const whLng = warehouseCoords[1];
  const destLat = destinationCoords[0];
  const destLng = destinationCoords[1];

  const drvLat = driverCoords ? driverCoords[0] : null;
  const drvLng = driverCoords ? driverCoords[1] : null;
  const hasDriver = drvLat !== null && drvLng !== null;

  const hasWarehouse = !isNaN(whLat) && !isNaN(whLng);
  const hasDest = !isNaN(destLat) && !isNaN(destLng);

  const centerLat = hasDest ? destLat : (hasWarehouse ? whLat : 34.5330);
  const centerLng = hasDest ? destLng : (hasWarehouse ? whLng : 69.1660);

  // 2. LIVE REAL-TIME TELEMETRY PUSH EFFECT BLOCK
  useEffect(() => {
    if (webViewRef.current && hasDriver) {
      const jsCode = `if (window.updateDriverPos) { window.updateDriverPos(${drvLat}, ${drvLng}); }`;
      webViewRef.current.injectJavaScript(jsCode);
    }
  }, [drvLat, drvLng, hasDriver]);

  // Dynamic map canvas dimensions redraw sync
  useEffect(() => {
    if (!loading) {
      webViewRef.current?.injectJavaScript(`
        if (typeof map !== 'undefined') {
          map.invalidateSize();
        }
        true;
      `);
    }
  }, [isFullscreen, loading]);

  const handleMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      console.log("🗺️ Map pin dropped coordinate data stream:", data);
    } catch (e) {
      console.log("Message parse bypass", e);
    }
  };

  // 3. ENCLOSED LEAFLET STRUCTURAL HTML GENERATION ENGINE
  const mapHtml = useMemo(() => {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=0.8, maximum-scale=1.0, user-scalable=no" />
        
        <!-- Fully qualified, explicit CDN paths for Leaflet -->
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
              integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
              crossorigin=""/>
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
                integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo="
                crossorigin=""></script>
        
        <style>
           html, body {
            margin: 0 !important;
            padding: 0 !important;
            width: 100vw !important;
            height: 100vh !important;
            overflow: hidden !important;
            background-color: #FAFAFA;
          }
   #map {
  height: 100vh;
  width: 100vw;
  background: #e0e0e0;

  touch-action: auto !important;
}
  .leaflet-container {
  touch-action: auto !important;
}
          .icon-label { font-size: 24px; text-align: center; filter: drop-shadow(0 2px 2px rgba(0,0,0,0.3)); }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <script>
         var map = L.map('map', {
  zoomControl: false,
  attributionControl: false,

  dragging: true,
  tap: true,
  touchZoom: true,
  doubleClickZoom: true,
  scrollWheelZoom: true,
  boxZoom: true,
  keyboard: false
}).setView([${centerLat}, ${centerLng}], 13);
          
          L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
            maxZoom: 20
          }).addTo(map);

          // 🎯 FIXED: Re-added explicit dimensions inside the internal divIcon wrapper setup
          function createEmojiIcon(emoji) {
            return L.divIcon({
              html: '<div class="icon-label">' + emoji + '</div>',
              className: 'custom-div-icon',
              iconSize: [30, 30],
              iconAnchor: [15, 30]
            });
          }

          // Warehouse Marker
          if (${showMarkers && hasWarehouse}) {
            L.marker([${whLat}, ${whLng}], {
              icon: createEmojiIcon('🏢')
            }).addTo(map).bindPopup("Store");
          }

          // Destination Marker
          var destMarker = null;
          if (${showMarkers && hasDest}) {
            destMarker = L.marker([${destLat}, ${destLng}], {
              icon: createEmojiIcon('📍')
            }).addTo(map);
          }

          // 🛵 INITIAL DRIVER POSITION SETUP
          var driverMarker = null;
          var initialDrvLat = parseFloat('${drvLat || ''}');
          var initialDrvLng = parseFloat('${drvLng || ''}');

          if (${showMarkers && hasDriver} && !isNaN(initialDrvLat) && !isNaN(initialDrvLng)) {
            driverMarker = L.marker([initialDrvLat, initialDrvLng], {
              icon: createEmojiIcon('🛵')
            }).addTo(map);
          }

          window.updateDriverPos = function(lat, lng) {
            var nextLat = parseFloat(lat);
            var nextLng = parseFloat(lng);
            
            if (!isNaN(nextLat) && !isNaN(nextLng)) {
              var newPos = [nextLat, nextLng];
              if (!driverMarker && ${showMarkers}) {
                driverMarker = L.marker(newPos, { icon: createEmojiIcon('🛵') }).addTo(map);
              } else {
                driverMarker.setLatLng(newPos);
              }
            }
          };

          // Interaction (USER Pin Dropping)
          if ('${role}' === 'USER' && ${showMarkers}) {
            map.on('click', function(e) {
              var lat = e.latlng.lat;
              var lng = e.latlng.lng;
              if (destMarker) map.removeLayer(destMarker);
              destMarker = L.marker([lat, lng], { icon: createEmojiIcon('📍') }).addTo(map);
              window.ReactNativeWebView.postMessage(JSON.stringify({ lat, lng }));
            });
          }

          // OSRM Routing Line Tracing Polyline
          var rawWhLat = parseFloat('${whLat}');
          var rawWhLng = parseFloat('${whLng}');
          var rawDestLat = parseFloat('${destLat}');
          var rawDestLng = parseFloat('${destLng}');

          if (${showMarkers} && !isNaN(rawWhLat) && !isNaN(rawWhLng) && !isNaN(rawDestLat) && !isNaN(rawDestLng)) {
            var url = 'https://router.project-osrm.org/route/v1/driving/' + 
                      rawWhLng + ',' + rawWhLat + ';' + rawDestLng + ',' + rawDestLat + 
                      '?overview=full&geometries=geojson';

            fetch(url)
              .then(function(r) { 
                if (!r.ok) throw new Error('OSRM Response Non-200');
                return r.json(); 
              })
              .then(function(data) {
                if (data.routes && data.routes.length > 0) {
                  L.geoJSON(data.routes[0].geometry, {
                    style: { color: '#0A1128', weight: 6, opacity: 0.8 }
                  }).addTo(map);
                  
                  var bounds = L.latLngBounds([
                    [rawWhLat, rawWhLng],
                    [rawDestLat, rawDestLng]
                  ]);
                  map.fitBounds(bounds, { padding: [40, 40] });
                }
              })
              .catch(function(err) { console.error('Route error:', err); });
          }

          setTimeout(function() { map.invalidateSize(); }, 500);
        </script>
      </body>
      </html>
    `;
  }, [role, whLat, whLng, destLat, destLng, drvLat, drvLng, hasDriver, hasWarehouse, hasDest, centerLat, centerLng, showMarkers]);
  return (
    <View style={[styles.container, activeFullscreen && styles.fullscreenContainer]}>
      
      {/* 🎯 FLOATING BACK EXIT ACTION BUTTON (Only pops up during full screen maps mode) */}
      {activeFullscreen && (
        <TouchableOpacity 
          style={styles.fullscreenCloseFloatingBtn}
          activeOpacity={0.8}
          onPress={() => {
            if (hasExternalFullscreenControl) {
              setIsFullscreen?.(false);
            } else {
              setInternalFullscreen(false);
            }
          }}
        >
          <Ionicons name="close" size={22} color="#000000" />
        </TouchableOpacity>
      )}

      {/* NATIVE INTERFACE WEB VIEW BROWSING BRIDGE */}
     <WebView
  ref={webViewRef}
  originWhitelist={['*']}
  source={{ html: mapHtml }}
  onLoadEnd={() => setLoading(false)}
  onMessage={handleMessage}
  javaScriptEnabled={true}
  domStorageEnabled={true}

  /* 🎯 CRITICAL FIX */
  nestedScrollEnabled={true}

  /* 🎯 PREVENT PARENT SCROLLVIEW FROM STEALING TOUCH */
  scrollEnabled={false}

  /* 🎯 ALLOW MAP GESTURES */
  androidLayerType="hardware"

  style={styles.map}
/>
      {/* FLOATING MAP CONTROLS */}
      {!loading && (
        <View style={styles.floatingControlsGroup}>

          {/* ZOOM IN */}
          <TouchableOpacity
            style={styles.controlPillBtn}
            activeOpacity={0.7}
            onPress={() =>
              webViewRef.current?.injectJavaScript(`
                map.zoomIn();
                true;
              `)
            }
          >
            <Ionicons name="add-sharp" size={20} color="#000000" />
          </TouchableOpacity>

          <View style={styles.pillHairlineDivider} />

          {/* ZOOM OUT */}
          <TouchableOpacity
            style={styles.controlPillBtn}
            activeOpacity={0.7}
            onPress={() =>
              webViewRef.current?.injectJavaScript(`
                map.zoomOut();
                true;
              `)
            }
          >
            <Ionicons name="remove-sharp" size={20} color="#000000" />
          </TouchableOpacity>

          <View style={styles.pillHairlineDivider} />

          {/* FULLSCREEN TOGGLE */}
          <TouchableOpacity
            style={styles.controlPillBtn}
            activeOpacity={0.7}
            onPress={() => {
              if (typeof setIsFullscreen === 'function') {
                setIsFullscreen(!activeFullscreen);
              } else {
                setInternalFullscreen(prev => !prev);
              }
            }}
          >
            <Ionicons
              name={activeFullscreen ? "contract-sharp" : "scan-sharp"}
              size={18}
              color="#000000"
            />
          </TouchableOpacity>

        </View>
      )}

      {/* LOADER */}
      {loading && (
        <View style={styles.loaderCover}>
          <ActivityIndicator size="small" color="#000000" />
        </View>
      )}
    </View>
  );
}

// 🎯 CLEANLY RE-STRUCTURED MONOCHROME STYLESHEET MATRIX
const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: '100%',
    backgroundColor: '#E0E0E0',
    position: 'relative'
  },
  // THE FULLSCREEN CONTAINER MATRIX OVERLAY
  fullscreenContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height,
    zIndex: 99999, 
    elevation: 99999,
    backgroundColor: '#FFFFFF'
  },
  // FLOATING MINIMALIST MONOCHROME BACK ARROW ACTION BUTTON LINK
  fullscreenCloseFloatingBtn: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 55 : 30,
    left: 20,
    zIndex: 100000,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EFEFEF',
    elevation: 6,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 4
  },
  map: {
    flex: 1,
    width: '100%',
    height: '100%'
  },
  loaderCover: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 99
  },
  floatingControlsGroup: {
    position: 'absolute',
    bottom: 24,
    right: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EFEFEF',
    borderRadius: 2,
    elevation: 4,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    zIndex: 100000
  },
  controlPillBtn: {
    width: 38,
    height: 38,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF'
  },
  pillHairlineDivider: {
    height: 1,
    backgroundColor: '#EEEEEE',
    width: '100%'
  }
});

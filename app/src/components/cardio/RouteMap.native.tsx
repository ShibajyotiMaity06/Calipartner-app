import { RoutePreview } from './RoutePreview';
import React, { useEffect, useRef, useMemo, useCallback } from 'react';
import { View, Platform } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { Button, Text, space } from '@calipartner/ui';
import { useTheme } from '@calipartner/ui/theme';
import type { RoutePoint } from '@calipartner/core';
import { t } from '@/i18n';
export function RouteMap({ points }: { points: RoutePoint[] }) {
  const { colors } = useTheme();
  const map = useRef<MapView>(null);
  const coordinates = useMemo(
    () => points.map((p) => ({ latitude: p.lat, longitude: p.lng })),
    [points],
  );
  const fit = useCallback(() => {
    if (coordinates.length)
      map.current?.fitToCoordinates(coordinates, {
        edgePadding: { top: space[6], bottom: space[6], left: space[6], right: space[6] },
        animated: false,
      });
  }, [coordinates]);
  useEffect(() => {
    fit();
  }, [fit]);
  if (Platform.OS === 'android' && !process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_KEY)
    return <RoutePreview points={points} />;
  if (!coordinates.length) return <Text>{t('launch.routeEmpty')}</Text>;
  return (
    <View testID="gps-route">
      <Text>{t('launch.route')}</Text>
      <MapView
        ref={map}
        style={{ width: '100%', aspectRatio: 1 }}
        onMapReady={fit}
        initialRegion={{ ...coordinates[0]!, latitudeDelta: 0.01, longitudeDelta: 0.01 }}
        accessibilityLabel={t('launch.routeSummary', { count: points.length })}
      >
        <Polyline coordinates={coordinates} strokeColor={colors.teal} />
        <Marker coordinate={coordinates[0]!} title={t('launch.start')} pinColor={colors.textHi} />
        <Marker
          coordinate={coordinates.at(-1)!}
          title={t('launch.current')}
          pinColor={colors.teal}
        />
      </MapView>
      <Button variant="secondary" label={t('launch.fit')} onPress={fit} testID="fit-gps-route" />
      <Text>{t('launch.routeSummary', { count: points.length })}</Text>
    </View>
  );
}

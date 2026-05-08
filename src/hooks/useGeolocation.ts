import { useState, useEffect } from 'react';
import { getCurrentCoords, type Coords } from '@/lib/geo';
import { supabase } from '@/lib/supabase';

/**
 * Requests device geolocation once on mount.
 * On success, saves coordinates to users.location in DB.
 * Returns current coords (null if unavailable/denied).
 */
export const useGeolocation = (userId?: string) => {
  const [coords, setCoords] = useState<Coords | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const position = await getCurrentCoords();
      if (cancelled) return;

      setCoords(position);
      setLoading(false);

      // Save to DB — fire and forget, non-blocking
      if (position && userId) {
        // NOTE: coords are rounded to ~1.1km precision before storing
        // to prevent exposing exact user location to other users.
        supabase
          .from('users')
          .update({
            location: {
              lat: Math.round(position.lat * 100) / 100,
              lng: Math.round(position.lng * 100) / 100,
            },
          })
          .eq('id', userId)
          .then(({ error }) => {
            if (error) console.warn('[Geo] Failed to save location:', error);
          });
      }
    };

    run();
    return () => { cancelled = true; };
  }, [userId]);

  return { coords, loading };
};

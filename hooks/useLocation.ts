
import { useState, useEffect } from 'react';
import { Geolocation } from '../types';

export const useLocation = () => {
  const [location, setLocation] = useState<Geolocation | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser.');
      return;
    }

    const handleSuccess = (position: GeolocationPosition) => {
      setLocation({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
      setError(null);
    };

    const handleError = (error: GeolocationPositionError) => {
      setError(`Error getting location: ${error.message}`);
    };

    navigator.geolocation.getCurrentPosition(handleSuccess, handleError);
  }, []);

  return { location, error };
};

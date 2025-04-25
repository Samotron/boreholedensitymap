'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useState } from 'react';

// Import Map component dynamically to avoid SSR issues with DeckGL
const Map = dynamic(() => import('../components/Map'), {
  ssr: false,
  loading: () => <div className="w-full h-screen flex items-center justify-center">Loading map component...</div>
});

interface ProcessedData {
  [resolution: number]: Array<{
    hexId: string;
    count: number;
  }>;
}

export default function Home() {
  const [data, setData] = useState<Array<{ hexId: string; count: number }>>([]);
  const [resolution, setResolution] = useState(3);
  const [error, setError] = useState<string | null>(null);

  const loadResolutionData = useCallback(async (resolution: number) => {
    try {
      const res = await fetch(`/boreholedensitymap/data/h3_scale_${resolution}.json`);
      if (!res.ok) {
        throw new Error('Failed to load data');
      }
      const loadedData = await res.json();
      if (!Array.isArray(loadedData)) {
        throw new Error('Invalid data format');
      }
      setData(loadedData.map(item => ({
        hexId: item.cell.toString(),
        count: item.count
      })));
    } catch (error: any) {
      console.error('Error loading data:', error);
      setError(error.message);
    }
  }, []);

  const handleResolutionChange = (newResolution: number) => {
    setResolution(newResolution);
    loadResolutionData(newResolution);
  };

  useEffect(() => {
    loadResolutionData(resolution);
  }, []);

  if (error) {
    return (
      <div className="w-full h-screen flex items-center justify-center flex-col gap-4">
        <p className="text-red-500">Error: {error}</p>
        <p className="text-sm">Make sure to run the preprocessing script first</p>
      </div>
    );
  }

  return (
    <div className="w-full h-screen">
      <Map />
    </div>
  );
}

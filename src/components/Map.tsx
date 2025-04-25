import React, { useEffect, useState, useCallback, useMemo } from 'react';
import DeckGL from '@deck.gl/react';
import { MapViewState } from '@deck.gl/core';
import { GeoJsonLayer, BitmapLayer } from '@deck.gl/layers';
import { TileLayer } from '@deck.gl/geo-layers';
import { FeatureCollection, Geometry } from 'geojson';
import { cellToBoundary } from 'h3-js';
import * as wellknown from 'wellknown';

const INITIAL_VIEW_STATE: MapViewState = {
  longitude: -2.5,
  latitude: 54.0,
  zoom: 5,
  pitch: 0,
  bearing: 0
};

// Color stops for heatmap
const COLOR_SCALE = [
  [0, [65, 182, 196, 180]],    // Light blue for low density
  [0.25, [127, 205, 187, 180]], // Cyan for medium-low
  [0.5, [199, 233, 180, 180]],  // Light green for medium
  [0.75, [252, 174, 145, 180]], // Light orange for medium-high
  [1, [215, 25, 28, 180]]      // Red for high density
];

// Function to interpolate colors
const interpolateColor = (value: number, colorScale: Array<[number, number[]]>) => {
  for (let i = 1; i < colorScale.length; i++) {
    const [prevStop, prevColor] = colorScale[i - 1];
    const [nextStop, nextColor] = colorScale[i];
    if (value <= nextStop) {
      const fraction = (value - prevStop) / (nextStop - prevStop);
      return prevColor.map((channel, index) => 
        Math.round(channel * (1 - fraction) + nextColor[index] * fraction)
      );
    }
  }
  return colorScale[colorScale.length - 1][1];
};

// Optimized resolution mapping for different zoom levels
const getResolutionForZoom = (zoom: number): number => {
  if (zoom <= 4) return 3;     // Country level
  if (zoom <= 5) return 4;     // Region level
  if (zoom <= 6.5) return 5;   // County level
  if (zoom <= 8) return 6;     // City level
  if (zoom <= 9.5) return 7;   // Neighborhood level
  return 7;                    // Street level
};

// Feature cache to store converted GeoJSON features
const featureCache: Record<number, FeatureCollection<Geometry>> = {};

const getHexDataForResolution = async (resolution: number): Promise<FeatureCollection<Geometry>> => {
  // Check cache first
  if (featureCache[resolution]) {
    return featureCache[resolution];
  }

  // Load data
  const filePath = `/boreholedensitymap/data/h3_scale_${resolution}.json`;
  console.log(`Loading resolution ${resolution}`);
  console.log(filePath);
  const response = await fetch(filePath);
  if (!response.ok) {
    throw new Error(`Failed to load data for resolution ${resolution}`);
  }

  const rawData = await response.json();
  
  // Convert to GeoJSON features
  const features = rawData.map(item => {
    let geometry;
    if (item.wkt) {
      // Use WKT geometry if available
      try {
        geometry = wellknown.parse(item.wkt);
      } catch (e) {
        console.error('Failed to parse WKT:', e);
        return null;
      }
    } else {
      // Fall back to H3 boundary
      const boundary = cellToBoundary(item.cell);
      geometry = {
        type: 'Polygon' as const,
        coordinates: [
          [...boundary.map(([lat, lng]) => [lng, lat]), boundary[0]].map(([lng, lat]) => [lng, lat])
        ]
      };
    }

    return {
      type: 'Feature' as const,
      geometry,
      properties: { count: item.count }
    };
  }).filter(Boolean);

  const featureCollection: FeatureCollection<Geometry> = {
    type: 'FeatureCollection',
    features
  };

  // Cache the result
  featureCache[resolution] = featureCollection;
  return featureCollection;
};

// Tooltip component
const Tooltip = ({
  object,
  x,
  y
}: {
  object: any;
  x: number;
  y: number;
}) => {
  if (!object) return null;

  return (
    <div style={{
      position: 'absolute',
      zIndex: 1,
      pointerEvents: 'none',
      left: x,
      top: y,
      backgroundColor: 'white',
      padding: '8px',
      borderRadius: '4px',
      boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
    }}>
      <div>Count: {object.properties.count}</div>
    </div>
  );
};

// Legend component
const Legend = () => (
  <div style={{
    position: 'absolute',
    bottom: '32px',
    right: '32px',
    background: 'white',
    padding: '12px',
    borderRadius: '4px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
    zIndex: 1,
  }}>
    <h3 style={{ margin: '0 0 8px 0', fontSize: '14px' }}>Borehole Density</h3>
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <div style={{ 
        width: '200px', 
        height: '20px',
        background: 'linear-gradient(to right, rgb(65,182,196), rgb(127,205,187), rgb(199,233,180), rgb(252,174,145), rgb(215,25,28))'
      }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', fontSize: '12px' }}>
        <span>Low</span>
        <span>High</span>
      </div>
    </div>
  </div>
);

// LayerControl component
const LayerControl = ({ 
  showBasemap, 
  showHexagons, 
  onToggleBasemap, 
  onToggleHexagons,
  selectedMetric,
  onMetricChange 
}: { 
  showBasemap: boolean; 
  showHexagons: boolean; 
  onToggleBasemap: () => void; 
  onToggleHexagons: () => void;
  selectedMetric: string;
  onMetricChange: (metric: string) => void;
}) => (
  <div style={{
    position: 'absolute',
    top: '20px',
    right: '20px',
    background: 'white',
    padding: '12px',
    borderRadius: '4px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
    zIndex: 1,
  }}>
    <div style={{ marginBottom: '12px' }}>
      <label style={{ fontSize: '14px', marginBottom: '8px', display: 'block' }}>Color By:</label>
      <select 
        value={selectedMetric} 
        onChange={(e) => onMetricChange(e.target.value)}
        style={{
          width: '100%',
          padding: '4px',
          borderRadius: '4px'
        }}
      >
        <option value="count">Borehole Count</option>
      </select>
    </div>
    <div style={{ marginBottom: '8px' }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={showBasemap}
          onChange={onToggleBasemap}
        />
        Basemap
      </label>
    </div>
    <div>
      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={showHexagons}
          onChange={onToggleHexagons}
        />
        Hexagon Layer
      </label>
    </div>
  </div>
);

export default function MapComponent() {
  const [currentResolution, setCurrentResolution] = useState(getResolutionForZoom(INITIAL_VIEW_STATE.zoom));
  const [hexData, setHexData] = useState<FeatureCollection<Geometry> | null>(null);
  const [viewState, setViewState] = useState(INITIAL_VIEW_STATE);
  const [maxCount, setMaxCount] = useState(100);
  const [showBasemap, setShowBasemap] = useState(true);
  const [showHexagons, setShowHexagons] = useState(true);
  const [hoverInfo, setHoverInfo] = useState<{object: any; x: number; y: number} | null>(null);
  const [selectedMetric, setSelectedMetric] = useState('count');

  // Update hex data when resolution changes
  useEffect(() => {
    const fetchHexData = async () => {
      try {
        const data = await getHexDataForResolution(currentResolution);
        setHexData(data);
      } catch (error) {
        console.error('Error fetching hex data:', error);
      }
    };

    fetchHexData();
  }, [currentResolution]);

  // Update max count when data changes
  useEffect(() => {
    if (hexData?.features) {
      const newMaxCount = Math.max(...hexData.features.map(f => f.properties.count));
      setMaxCount(newMaxCount);
    }
  }, [hexData]);

  // Handle view state changes
  const onViewStateChange = useCallback(({viewState}: {viewState: MapViewState}) => {
    setViewState(viewState);
    const newResolution = getResolutionForZoom(viewState.zoom);
    if (newResolution !== currentResolution) {
      setCurrentResolution(newResolution);
    }
  }, [currentResolution]);

  // Memoize basemap layer
  const basemapLayer = useMemo(() => new TileLayer({
    id: 'basemap',
    data: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    minZoom: 0,
    maxZoom: 19,
    tileSize: 256,
    visible: showBasemap,
    renderSubLayers: props => {
      const {
        bbox: { left, bottom, right, top }
      } = props.tile;

      return new BitmapLayer(props, {
        data: null,
        image: props.data,
        bounds: [left, bottom, right, top]
      });
    }
  }), [showBasemap]);

  // Memoize color calculation function
  const getHexagonColor = useCallback((feature: any) => {
    const count = feature.properties.count;
    const normalizedValue = Math.log(count + 1) / Math.log(maxCount + 1);
    return interpolateColor(normalizedValue, COLOR_SCALE);
  }, [maxCount]);

  // Memoize hexagon layer with hover handling
  const hexagonLayer = useMemo(() => new GeoJsonLayer({
    id: 'hexagons',
    data: hexData || { type: 'FeatureCollection', features: [] },
    filled: true,
    getFillColor: getHexagonColor,
    stroked: true,
    getLineColor: [0, 0, 0, 80],
    lineWidthMinPixels: 1,
    pickable: true,
    visible: showHexagons,
    autoHighlight: true,
    onHover: (info: any) => {
      setHoverInfo(info.object ? {
        object: info.object,
        x: info.x,
        y: info.y
      } : null);
    },
    transitions: {
      getFillColor: 300
    },
    updateTriggers: {
      getFillColor: [maxCount]
    }
  }), [hexData, getHexagonColor, maxCount, showHexagons]);

  return (
    <>
      <DeckGL
        initialViewState={INITIAL_VIEW_STATE}
        viewState={viewState}
        onViewStateChange={onViewStateChange}
        controller
        layers={[basemapLayer, hexagonLayer]}
      />
      <LayerControl
        showBasemap={showBasemap}
        showHexagons={showHexagons}
        selectedMetric={selectedMetric}
        onMetricChange={setSelectedMetric}
        onToggleBasemap={() => setShowBasemap(!showBasemap)}
        onToggleHexagons={() => setShowHexagons(!showHexagons)}
      />
      <Legend />
      {hoverInfo && <Tooltip {...hoverInfo} />}
    </>
  );
}
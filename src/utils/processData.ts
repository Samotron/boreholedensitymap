import { latLngToCell, cellToLatLng, h3ToParent } from 'h3-js';

interface Point {
  latitude: number;
  longitude: number;
}

interface HexagonData {
  hexId: string;
  count: number;
}

export function processBoreholeData(points: Point[], resolution: number): HexagonData[] {
  // Create a map to store hexagon counts
  const hexagonCounts = new Map<string, number>();

  // Process each point
  points.forEach(point => {
    const hexId = latLngToCell(point.latitude, point.longitude, resolution);
    hexagonCounts.set(hexId, (hexagonCounts.get(hexId) || 0) + 1);
  });

  // Convert the map to array format
  return Array.from(hexagonCounts.entries()).map(([hexId, count]) => ({
    hexId,
    count
  }));
}

// Function to aggregate data to a different resolution
export function aggregateToResolution(data: { hexId: string; count: number }[], targetResolution: number) {
  const aggregatedCounts = new Map<string, number>();

  data.forEach(({ hexId, count }) => {
    const parentHexId = h3ToParent(hexId, targetResolution);
    aggregatedCounts.set(parentHexId, (aggregatedCounts.get(parentHexId) || 0) + count);
  });

  return Array.from(aggregatedCounts.entries()).map(([hexId, count]) => ({
    hexId,
    count
  }));
}

// Example preprocessing script
export function preprocessGeoParquet(filePath: string) {
  // Note: This is a placeholder for the actual implementation
  // You would need to use a library like Apache Arrow or a similar tool
  // to read and process the geoparquet file
  console.log('Preprocessing geoparquet file:', filePath);
  
  /* Example implementation would look like:
  import { readParquet } from 'apache-arrow';
  
  const table = await readParquet(filePath);
  const points = table.toArray().map(row => ({
    latitude: row.latitude,
    longitude: row.longitude
  }));
  
  // Process points at different resolutions
  const resolutions = [3, 4, 5, 6, 7];
  const results = {};
  
  resolutions.forEach(resolution => {
    results[resolution] = processBoreholeData(points, resolution);
  });
  
  // Save results to JSON file
  await writeFile('processed_data.json', JSON.stringify(results));
  */
}
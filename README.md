# UK Borehole Density Map

An interactive web application for visualizing the density of boreholes across the United Kingdom using hexagonal binning.

![UK Borehole Density Map](public/screenshot.png)

## Features

- Interactive map visualization of borehole density across the UK
- Hierarchical hexagonal binning (H3) for efficient data aggregation
- Automatic resolution adjustment based on zoom level
- Color-coded visualization of borehole density (low to high)
- Toggle between different metrics (total boreholes, AGS boreholes, AGS percentage)
- Custom GeoJSON upload for overlaying your own spatial data
- Responsive design with sidebar navigation

## Getting Started

### Prerequisites

- Node.js 16.8 or later
- Python 3.8+ (for data preprocessing)
- UV package manager for Python

### Installation

1. Clone the repository
```bash
git clone https://github.com/samotron/boreholedensitymap.git
cd boreholedensitymap
```

2. Install dependencies
```bash
npm install
# or
yarn install
# or
bun install
```

3. Run the development server
```bash
npm run dev
# or
yarn dev
# or
bun dev
```

4. Open [http://localhost:3000](http://localhost:3000) with your browser to see the application.

### Data Processing

The application uses preprocessed data stored in the `public/data` directory. If you need to reprocess the raw data:

1. Install Python dependencies using uv and run script
```bash
uv run scripts/processor.py
```


## Technology Stack

- [Next.js](https://nextjs.org/) - React framework
- [DeckGL](https://deck.gl/) - WebGL-powered visualization
- [H3](https://h3geo.org/) - Hierarchical hexagonal geospatial indexing system
- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS framework

## How It Works

The application uses hexagonal binning to aggregate borehole data at different zoom levels. This approach provides an efficient way to visualize the density of geological sampling across various geographical scales.

### Color Scale

The color scale used to visualize density follows this pattern:
- Blue: Low density areas
- Yellow-green: Medium density
- Red: High density areas

### Data Sources

The data is sourced from the British Geological Survey (BGS) Borehole Index, which maintains records of boreholes, shafts, and wells across Great Britain.

## Custom Data Upload

Users can upload their own GeoJSON files to overlay on the map. This enables comparison between the borehole density patterns and custom datasets.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Contains British Geological Survey materials © UKRI [2025]
- Basemap © OpenStreetMap contributors
- Powered by DeckGL and H3 hexagonal binning

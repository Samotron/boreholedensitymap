# /// script
# requires-python = ">=3.12"
# dependencies = [
#     "duckdb",
#     "requests",
# ]
# ///

import duckdb
import os
import requests
import zipfile
from pathlib import Path
from datetime import datetime, timedelta


def is_file_older_than_two_weeks(filepath: str) -> bool:
    """Check if a file is older than two weeks."""
    if not os.path.exists(filepath):
        return True
    
    file_time = datetime.fromtimestamp(os.path.getmtime(filepath))
    two_weeks_ago = datetime.now() - timedelta(weeks=2)
    return file_time < two_weeks_ago


def download_borehole_data(url: str, output_file: str) -> None:
    print(f"📥 Downloading borehole data to {output_file}...")
    response = requests.get(url, stream=True)
    response.raise_for_status()
    with open(output_file, 'wb') as f:
        for chunk in response.iter_content(chunk_size=8192):
            f.write(chunk)
    print("✅ Download complete!")


def extract_zip(zip_file: str, extract_path: str) -> None:
    print(f"📦 Extracting {zip_file} to {extract_path}...")
    with zipfile.ZipFile(zip_file, 'r') as zip_ref:
        zip_ref.extractall(extract_path)
    print("🎉 Extraction complete!")


def main() -> None:
    print("🚀 Starting borehole data processing...")
    
    # Download and extract borehole data
    borehole_url = "https://www.bgs.ac.uk/download/single-onshore-borehole-index-sobi-dataset/?wpdmdl=117205&refresh=680bebe4ded481745611748"
    zip_file = "boreholes.zip"
    extract_path = "borehole"
    shapefile_path = os.path.join(extract_path, "borehole.shp")

    # Create necessary directories
    Path(extract_path).mkdir(exist_ok=True)
    Path("public/data").mkdir(parents=True, exist_ok=True)
    print("📁 Created necessary directories")

    # Check if we need to download and extract new data
    if is_file_older_than_two_weeks(shapefile_path):
        print("🕒 Shapefile is either missing or older than two weeks. Downloading fresh data...")
        download_borehole_data(borehole_url, zip_file)
        extract_zip(zip_file, extract_path)
        
        # Clean up zip file after extraction
        if os.path.exists(zip_file):
            os.remove(zip_file)
            print("🧹 Cleaned up temporary zip file")
    else:
        print("✨ Using existing shapefile (less than two weeks old)")


if __name__ == "__main__":
    main()
    
    print("🗄️  Connecting to DuckDB...")
    db = duckdb.connect()
    print("🔌 Installing and loading extensions...")
    db.execute("INSTALL spatial; LOAD spatial")
    db.execute("INSTALL json; LOAD json")
    db.execute("INSTALL h3 FROM community; LOAD h3;")

    shapefilepath = r"./borehole/borehole.shp"
    print(f"📍 Loading shapefile from: {shapefilepath}")

    print("🌍 Creating boreholes table...")
    db.sql(f"CREATE TABLE boreholes AS SELECT * FROM ST_READ('{shapefilepath}')")
    print("🔄 Transforming coordinates...")
    db.sql(
        "UPDATE boreholes SET geom = ST_Transform(geom, 'EPSG:27700', 'EPSG:4326', always_xy := true)"
    )
    print("📊 Adding coordinate columns...")
    db.sql(
        "ALTER TABLE boreholes ADD COLUMN lon DOUBLE; ALTER TABLE boreholes ADD COLUMN lat DOUBLE; "
    )
    db.sql("UPDATE boreholes SET  lon = ST_X(geom),  lat = ST_Y(geom);")
    
    print("🔷 Processing H3 scales...")
    scales = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]
    for i in scales:
        print(f"  ⚡ Processing H3 scale {i}...")
        db.sql(
            f"ALTER TABLE boreholes ADD COLUMN h3_scale_{i} BIGINT; UPDATE boreholes SET h3_scale_{i} = h3_latlng_to_cell(lat, lon, {i});"
        )
    print("📋 Boreholes table summary:")
    print(db.sql("SELECT * FROM BOREHOLES"))

    print("📊 Generating H3 scale aggregations...")
    for j in scales:
        print(f"  💾 Creating and exporting H3 scale {j}...")
        db.sql(
            f"CREATE TABLE boreholes_h3_scale_{j} AS SELECT h3_scale_{j} as cell, h3_cell_to_boundary_wkt(h3_scale_{j}) as wkt, COUNT(h3_scale_{j}) as count FROM boreholes GROUP BY h3_scale_{j}"
        )
        db.sql(f"COPY boreholes_h3_scale_{j} TO './public/data/h3_scale_{j}.json' (ARRAY)")
        print(f"  📊 Summary for scale {j}:")
        print(db.sql(f"SELECT * FROM BOREHOLES_H3_SCALE_{j}"))
        db.sql(f"DROP TABLE BOREHOLES_H3_SCALE_{j}")

    print("✨ Processing completed successfully! ✨")

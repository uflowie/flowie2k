# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a music streaming server built on the Cloudflare ecosystem using Hono, D1 database, and R2 storage. The server extracts metadata from MP3 files, stores audio files and thumbnails in R2, and provides a web interface for upload, streaming, and management.

## Development Commands

```bash
# Start local development server
npm run dev

# Deploy to Cloudflare Workers
npm run deploy

# Generate TypeScript types for Cloudflare bindings
npm run cf-typegen
```

## Database Operations

```bash
# Create D1 database (first time setup)
npx wrangler d1 create music-server-db

# Apply initial schema
npx wrangler d1 execute music-server-db --local --file=schema.sql

# Apply migrations
npx wrangler d1 execute music-server-db --local --file=migration_add_thumbnail.sql
npx wrangler d1 execute music-server-db --local --file=migration_remove_analytics.sql

# For production database
npx wrangler d1 execute music-server-db --file=schema.sql
```

## R2 Storage Operations

```bash
# Create R2 bucket (first time setup)
npx wrangler r2 bucket create music-server-storage
```

## Architecture

### Core Components

**src/index.ts**: Single-file Hono application containing:
- REST API endpoints for music operations
- Embedded HTML test frontend
- MP3 metadata extraction using `music-metadata` library
- D1 database operations for track metadata
- R2 storage operations for audio files and thumbnails

### Cloudflare Bindings

**wrangler.jsonc** configures two key bindings:
- `MUSIC_BUCKET`: R2 bucket for storing audio files and extracted album art
- `MUSIC_DB`: D1 database for track metadata

### Database Schema

**schema.sql** defines:
- `tracks` table: Core metadata (title, artist, album, file_size, duration, etc.)
- Indexes optimized for common queries (filename, artist, album lookups)

### Data Flow

1. **Upload**: Client sends MP3 → Server extracts metadata/album art → Stores file in R2 → Saves metadata to D1
2. **Stream**: Client requests file → Streams from R2 with range request support
3. **Thumbnails**: Extracted album art stored separately in R2 under `thumbnails/` prefix, served via `/thumbnail/:filename`

### Key Features

- **MP3 Metadata Extraction**: Automatic parsing of ID3 tags (title, artist, album, genre, duration)
- **Album Art Support**: Extracts embedded images and stores as separate thumbnails
- **Range Request Support**: Enables seeking in audio players
- **Migration Tools**: Bulk upload scripts for existing music collections

## Migration Scripts

**bulk_upload.js**: Production-ready script for migrating large music collections with:
- Concurrent uploads (configurable batch size)
- Retry logic and error handling
- Progress tracking and detailed reporting
- Automatic metadata extraction during upload

**upload_music.js**: Simple sequential upload script for smaller collections

## File Organization

- Audio files stored in R2 with original filenames
- Album art stored as `thumbnails/{filename_without_ext}.{jpg|png}`
- All file operations go through the Worker API endpoints
- Local `music/` directory used only for development file storage

## Applying Schema Changes

To apply the analytics cleanup changes to an existing database:

### Local Development Database
```bash
# Apply the analytics removal migration
npx wrangler d1 execute music-server-db --local --file=migration_remove_analytics.sql
```

### Production Database
```bash
# Backup production data first (recommended)
npx wrangler d1 execute music-server-db --command="SELECT * FROM tracks" > tracks_backup.sql

# Apply the analytics removal migration
npx wrangler d1 execute music-server-db --file=migration_remove_analytics.sql
```

## Development Notes

- Requires Node.js 18+ for fetch support in upload scripts
- Uses `nodejs_compat` flag for Buffer support in metadata parsing
- Frontend embedded in main server file for simplicity during development
- Simplified database schema focused on core music metadata
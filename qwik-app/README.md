# RFID Access Control Dashboard - Qwik App

## Overview

This is the web dashboard for the RFID-MQTT IoT Access Control System, built with Qwik framework.

## 🔒 HTTPS-Only Configuration

**Important**: This application requires HTTPS to run. SSL certificates are automatically generated on first start.

### Why HTTPS Only?

- **PWA Requirements**: Progressive Web Apps require HTTPS
- **Security**: Protects user data and sessions
- **Modern Standards**: Many browser features require secure context
- **Best Practices**: Even in development, HTTPS is recommended

### Automatic Certificate Generation

Certificates are automatically generated when you run:
```bash
npm run dev
```

The `predev` hook automatically runs `generate-certs.js` before starting the server.

### Manual Certificate Generation

If you need to regenerate certificates:
```bash
npm run generate-certs
```

This requires either:
- **OpenSSL** (included with Git for Windows)
- **mkcert** (alternative, creates trusted certificates)

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Start development server (HTTPS on port 5174)
npm run dev
```

Access: `https://localhost:5174`

**First-time users**: You'll see a browser warning about the self-signed certificate. Click "Advanced" → "Proceed to localhost". This is normal for development.

## 📦 Available Scripts

- `npm run dev` - Start development server (auto-generates certificates)
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run generate-certs` - Manually generate SSL certificates
- `npm run lint` - Run ESLint
- `npm run fmt` - Format code with Prettier
- `npm run live-updates` - Start the secure WebSocket bridge for real-time logs

## 🔁 Live Updates Bridge

New RFID scans are streamed to the dashboard over a dedicated WebSocket bridge.

1. **Start the PHP backend** (via XAMPP/Apache on port 81 by default).
2. **Start the dashboard + live updates**:
   ```bash
   npm run dev
   ```
   This command now runs both Vite (the dashboard) and `scripts/live-updates-server.js`, serving
   `wss://localhost:9443` and a POST `/broadcast` helper endpoint.

Need the bridge alone for tooling/tests? You can still run it manually via `npm run live-updates`.

When all three services are running, RFID scans are displayed instantly—no manual refresh required. The dashboard shows the bridge status in the header and automatically falls back to periodic REST polling if the socket is offline.

### Bridge configuration

The bridge reads self-signed certificates from `./certs/`. You can override defaults with environment variables before running the script:

```bash
set REALTIME_BRIDGE_URL=https://192.168.0.10:9443/broadcast
set REALTIME_BRIDGE_ENABLED=1
```

Available variables:

- `REALTIME_BRIDGE_URL` – full URL for the PHP backend to call (defaults to `https://localhost:9443/broadcast`).
- `REALTIME_BRIDGE_ENABLED` – set to `0` to disable PHP notifications (useful for development without the bridge).

On the client, optional build-time overrides exist via `PUBLIC_LIVE_UPDATES_URL`, `PUBLIC_LIVE_UPDATES_PORT`, and `PUBLIC_LIVE_UPDATES_PATH`.

## 🔧 Configuration

### API Endpoint

The dashboard fetches data from the PHP backend. Update in `src/routes/index.tsx`:

```typescript
const API_BASE_URL = "http://localhost/php-backend/api";
```

**Note**: The backend uses HTTP (localhost is secure enough for local development), but the dashboard itself runs on HTTPS.

### Port Configuration

Default port: `5174` (HTTPS)

This is configured in `vite.config.ts`. The server will use a fallback port if 5174 is busy.

## 🛠️ Development

### Project Structure

```
qwik-app/
├── src/
│   ├── components/
│   │   ├── rfid-status.tsx    # Registered RFIDs display
│   │   └── rfid-logs.tsx      # Logs table
│   ├── routes/
│   │   └── index.tsx          # Main dashboard
│   ├── global.css             # Global styles
│   └── root.tsx               # Root component
├── scripts/
│   ├── generate-certs.js      # SSL certificate generator
│   └── live-updates-server.js # HTTPS WebSocket + REST bridge
├── certs/                     # SSL certificates (auto-generated)
│   ├── localhost-key.pem
│   └── localhost-cert.pem
├── vite.config.ts             # Vite configuration
└── package.json
```

### Features

- **Real-time Updates**: Secure WebSocket bridge with exponential backoff and REST fallback
- **Responsive Design**: Mobile-first CSS
- **Offline Support**: PWA manifest
- **Type Safety**: Full TypeScript support
- **Component-based**: Modular architecture

## 🔐 SSL Certificates

### Certificate Location

Certificates are stored in `./certs/`:
- `localhost-key.pem` - Private key
- `localhost-cert.pem` - Certificate

### Certificate Details

- **Type**: Self-signed
- **Validity**: 365 days
- **Subject**: CN=localhost
- **Algorithm**: RSA 2048-bit

### Troubleshooting Certificates

**Issue**: Certificates not found

```bash
# Solution 1: Ensure Git for Windows is installed
# Download: https://git-scm.com/download/win

# Solution 2: Use mkcert (creates trusted certificates)
choco install mkcert
# or
scoop install mkcert
```

**Issue**: Browser still shows warning

This is expected with self-signed certificates. For trusted certificates:

```bash
# Install mkcert
npm install -g mkcert

# Install local CA
mkcert -install

# Generate trusted certificates
cd qwik-app/certs
mkcert localhost
```

## 🌐 Browser Compatibility

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari, Chrome Mobile)

All modern browsers support the required features.

## 📱 PWA Support

The app includes a PWA manifest (`public/manifest.json`) for installation on mobile devices and desktop.

Features:
- Installable on home screen
- Offline capability
- Full-screen mode
- Custom app icon

## 🐛 Common Issues

### Port Already in Use

If port 5174 is busy, the server will try the next available port. Check the console output for the actual port.

### Mixed Content Warnings

The dashboard (HTTPS) fetches from the PHP backend (HTTP localhost). This is allowed by browsers for localhost.

### Certificate Expired

Certificates are valid for 365 days. Regenerate:

```bash
rm -rf certs/
npm run generate-certs
```

### CORS Errors

Ensure PHP backend has CORS headers enabled. Check `.htaccess` in `php-backend/` folder.

## 📚 Learn More

- [Qwik Documentation](https://qwik.builder.io/)
- [Vite Documentation](https://vitejs.dev/)
- [TypeScript Documentation](https://www.typescriptlang.org/)

## 🆘 Support

For issues specific to the RFID-MQTT system, see:
- Main `README.md` in project root
- `TESTING_GUIDE.md` for detailed testing
- `SETUP_GUIDE.md` for quick setup

---

**Built with Qwik** ⚡️

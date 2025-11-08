# HTTPS Configuration Guide

## Overview

The RFID-MQTT web dashboard is configured to run **HTTPS-only** for security and modern web standards compliance.

## Why HTTPS Only?

### Security Benefits
- **Data Protection**: Encrypts all data between browser and server
- **Session Security**: Protects authentication tokens and cookies
- **Integrity**: Prevents man-in-the-middle attacks
- **Privacy**: Protects user activity from network eavesdropping

### Technical Requirements
- **PWA Support**: Progressive Web Apps require HTTPS
- **Modern APIs**: Many browser features (geolocation, camera, etc.) require secure context
- **Service Workers**: Offline capability requires HTTPS
- **Best Practice**: Industry standard even in development

## Architecture

### What Uses HTTPS
✅ **Web Dashboard**: `https://localhost:5174`
- Qwik application
- User interface
- Real-time updates
- All client-side code

### What Uses HTTP
✅ **PHP Backend**: `http://localhost/php-backend/api/`
- API endpoints
- Database queries
- Server-side processing

✅ **ESP32 Communication**: `http://[LOCAL_IP]/php-backend/api/`
- RFID verification requests
- Scan logging
- Status updates

### Why Mixed Protocol?

**Dashboard → Backend (HTTPS → HTTP)**:
- Allowed by browsers for localhost
- Simplifies ESP32 firmware (no SSL overhead)
- Acceptable for local IoT networks
- ESP32 HTTPClient is simpler than WiFiClientSecure

**For Production**: Use HTTPS everywhere with valid certificates

## Certificate Setup

### Automatic Generation

Certificates are **automatically generated** when you run:

```bash
npm run dev
```

The `predev` hook runs before the dev server starts and creates certificates if they don't exist.

### Manual Generation

```bash
cd qwik-app
npm run generate-certs
```

### Certificate Details

**Location**: `qwik-app/certs/`
- `localhost-key.pem` - Private key (2048-bit RSA)
- `localhost-cert.pem` - Certificate (X.509, self-signed)

**Properties**:
- **Subject**: CN=localhost
- **Validity**: 365 days from generation
- **Algorithm**: SHA-256 with RSA encryption
- **Key Size**: 2048 bits

**Security Note**: These are self-signed certificates suitable for development only. For production, use certificates from a trusted Certificate Authority (e.g., Let's Encrypt).

## Installation Methods

### Method 1: OpenSSL (Recommended)

**Via Git for Windows** (Easiest on Windows):
1. Download Git for Windows: https://git-scm.com/download/win
2. Install with default settings
3. Git includes OpenSSL in `C:\Program Files\Git\usr\bin\`
4. Run: `npm run generate-certs`

**Standalone OpenSSL**:
1. Download: https://slproweb.com/products/Win32OpenSSL.html
2. Install "Win64 OpenSSL v3.x.x Light"
3. Add to PATH: `C:\Program Files\OpenSSL-Win64\bin`
4. Run: `npm run generate-certs`

### Method 2: mkcert (No Browser Warnings)

**Advantages**:
- Creates trusted certificates
- No browser security warnings
- Installs local Certificate Authority
- Cleaner development experience

**Installation**:

```bash
# Windows with Chocolatey
choco install mkcert

# Windows with Scoop
scoop bucket add extras
scoop install mkcert

# After installation
cd qwik-app
npm run generate-certs
```

**First-time setup**:
```bash
mkcert -install
```

This installs a local CA trusted by your system and browsers.

## Browser Security Warnings

### With Self-Signed Certificates (OpenSSL)

When you first access `https://localhost:5174`, you'll see:

**Chrome/Edge**:
- "Your connection is not private"
- Error: NET::ERR_CERT_AUTHORITY_INVALID
- Click "Advanced" → "Proceed to localhost (unsafe)"

**Firefox**:
- "Warning: Potential Security Risk Ahead"
- Click "Advanced" → "Accept the Risk and Continue"

**Safari**:
- "This Connection Is Not Private"
- Click "Show Details" → "visit this website"

### With mkcert (Trusted)

No warnings! Certificates are automatically trusted.

## Troubleshooting

### Error: SSL Certificates Not Found

**Symptom**: Server fails to start with error message

**Solution**:
```bash
cd qwik-app
npm run generate-certs
```

Ensure OpenSSL or mkcert is installed (see Installation Methods above).

### Error: Command 'openssl' not found

**Windows**:
1. Install Git for Windows
2. Or add OpenSSL to PATH
3. Restart terminal after installation

**Verify**:
```bash
openssl version
# Should output: OpenSSL 3.x.x ...
```

### Browser Still Shows Warning

**With OpenSSL**: This is normal. Self-signed certificates always show warnings.

**With mkcert**: 
1. Ensure you ran: `mkcert -install`
2. Restart browser completely
3. Check certificate is from "mkcert [username]"

### Certificate Expired

Certificates are valid for 365 days. To regenerate:

```bash
cd qwik-app
rm -rf certs/
npm run generate-certs
```

Or simply delete the `certs` folder and run `npm run dev`.

### Mixed Content Warnings

**Symptom**: Dashboard loads but API calls fail

**Cause**: Browser blocking HTTP requests from HTTPS page

**Solution**: This should NOT happen on localhost. If it does:
1. Check you're accessing via `https://localhost:5174`
2. Verify API_BASE_URL uses `http://localhost` (not your external IP)
3. Browsers allow HTTPS → HTTP on localhost for development

### Port 5174 Already in Use

**Solution 1**: Kill the process using the port
```bash
# Windows
netstat -ano | findstr :5174
taskkill /PID [PID] /F

# Or simply close the previous dev server
```

**Solution 2**: Server will automatically try next available port

## Configuration Files

### vite.config.ts

```typescript
server: {
  https: {
    key: fs.readFileSync('./certs/localhost-key.pem'),
    cert: fs.readFileSync('./certs/localhost-cert.pem'),
  },
  port: 5174,
  host: true,
}
```

### package.json

```json
{
  "scripts": {
    "predev": "node scripts/generate-certs.js",
    "dev": "vite --mode ssr",
    "generate-certs": "node scripts/generate-certs.js"
  }
}
```

### generate-certs.js

Located in `qwik-app/scripts/generate-certs.js`

Features:
- Auto-detects OpenSSL (PATH or Git Bash)
- Falls back to mkcert if available
- Provides helpful error messages
- Skips if certificates already exist

## Production Deployment

### Do NOT Use Self-Signed Certificates in Production

For production deployment:

1. **Get Valid Certificate**:
   - Let's Encrypt (free): https://letsencrypt.org/
   - Certbot (automation): https://certbot.eff.org/
   - Or commercial CA (Digicert, etc.)

2. **Update Backend to HTTPS**:
   - Configure Apache/Nginx with SSL
   - Update ESP32 firmware to use HTTPS
   - Implement certificate verification

3. **ESP32 HTTPS**:
   ```cpp
   #include <WiFiClientSecure.h>
   WiFiClientSecure client;
   client.setInsecure(); // For testing
   // Or load CA certificate:
   client.setCACert(root_ca);
   ```

4. **Security Hardening**:
   - Use strong cipher suites
   - Enable HSTS headers
   - Implement certificate pinning
   - Regular certificate renewal

## Testing

### Verify HTTPS is Working

1. **Check URL**: Should be `https://localhost:5174` (not http)

2. **Check Certificate**:
   - Click padlock icon in browser
   - View certificate details
   - Verify: CN=localhost, Valid dates

3. **Check Console**: No mixed content warnings

4. **Test API Calls**: Network tab should show successful requests

### Test Certificate Generation

```bash
cd qwik-app

# Remove existing certificates
rm -rf certs/

# Regenerate
npm run generate-certs

# Verify files exist
ls certs/
# Should show: localhost-key.pem, localhost-cert.pem

# Check certificate details
openssl x509 -in certs/localhost-cert.pem -text -noout
```

## Security Considerations

### Development (Current Setup)
- ✅ HTTPS for web interface
- ✅ Self-signed certificates (acceptable)
- ✅ HTTP backend on localhost (acceptable)
- ✅ ESP32 uses HTTP (acceptable for local IoT)

### Production Requirements
- ⚠️ Valid SSL certificates from trusted CA
- ⚠️ HTTPS for all endpoints
- ⚠️ Certificate verification on ESP32
- ⚠️ Regular certificate renewal
- ⚠️ Strong database passwords
- ⚠️ API authentication
- ⚠️ MQTT TLS encryption

## FAQ

**Q: Why do I see a security warning?**
A: Self-signed certificates are not trusted by default. Click "Proceed" to continue. This is safe for localhost development.

**Q: Can I use HTTP instead?**
A: No. The application is configured for HTTPS-only. This is required for PWA features and best security practices.

**Q: Do I need to regenerate certificates often?**
A: No. Certificates are valid for 365 days. You can reuse them throughout development.

**Q: Will other devices on my network see warnings?**
A: Yes, if they access your development server. Each device must accept the certificate.

**Q: How do I trust the certificate permanently?**
A: Use mkcert instead of OpenSSL. It creates trusted certificates automatically.

**Q: Can I use my own certificates?**
A: Yes. Place `localhost-key.pem` and `localhost-cert.pem` in `qwik-app/certs/` directory.

**Q: Does ESP32 use HTTPS?**
A: No, ESP32 uses HTTP to the PHP backend. This is acceptable on local networks and simplifies firmware.

## Resources

- [Let's Encrypt](https://letsencrypt.org/) - Free SSL certificates
- [mkcert](https://github.com/FiloSottile/mkcert) - Local certificate tool
- [OpenSSL](https://www.openssl.org/) - SSL toolkit
- [MDN: Mixed Content](https://developer.mozilla.org/en-US/docs/Web/Security/Mixed_content)
- [Chrome HTTPS Requirements](https://developers.google.com/web/fundamentals/security/encrypt-in-transit/why-https)

---

**Security First** 🔒

Even in development, HTTPS protects your workflow and prepares you for production deployment.


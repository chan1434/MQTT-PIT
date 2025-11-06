/**
 * SSL Certificate Generator for HTTPS Development
 * 
 * This script generates self-signed SSL certificates for local HTTPS development.
 * Certificates will be created in the 'certs' directory.
 * 
 * Supports:
 * - OpenSSL (preferred, included with Git for Windows)
 * - mkcert (alternative, easier to trust, no browser warnings)
 * 
 * Automatically runs before 'npm run dev' via predev hook.
 */

import { execSync, spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const certsDir = path.join(__dirname, '..', 'certs');
const keyPath = path.join(certsDir, 'localhost-key.pem');
const certPath = path.join(certsDir, 'localhost-cert.pem');

// Create certs directory if it doesn't exist
if (!fs.existsSync(certsDir)) {
  fs.mkdirSync(certsDir, { recursive: true });
  console.log('✓ Created certs directory');
}

// Check if certificates already exist
if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
  console.log('✓ SSL certificates already exist');
  console.log('  Key:', keyPath);
  console.log('  Cert:', certPath);
  console.log('');
  console.log('🔒 HTTPS development server ready!');
  console.log('   Run: npm run dev');
  process.exit(0);
}

console.log('🔐 Generating SSL certificates for HTTPS development...');
console.log('');

// Check if OpenSSL is available
function checkCommand(command) {
  try {
    const result = spawnSync(command, ['version'], { 
      stdio: 'pipe',
      shell: os.platform() === 'win32' // Use shell on Windows to find commands in PATH
    });
    return result.status === 0;
  } catch (error) {
    return false;
  }
}

// Check common Git Bash locations on Windows
function findGitBashOpenSSL() {
  if (os.platform() !== 'win32') return null;
  
  const commonPaths = [
    'C:\\Program Files\\Git\\usr\\bin\\openssl.exe',
    'C:\\Program Files (x86)\\Git\\usr\\bin\\openssl.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Git', 'usr', 'bin', 'openssl.exe')
  ];
  
  for (const opensslPath of commonPaths) {
    if (fs.existsSync(opensslPath)) {
      return opensslPath;
    }
  }
  return null;
}

// Try OpenSSL first (check in PATH)
let opensslCommand = 'openssl';
if (checkCommand('openssl')) {
  console.log('✓ OpenSSL detected in PATH, generating certificates...');
} else {
  // Try to find Git Bash OpenSSL on Windows
  const gitBashOpenSSL = findGitBashOpenSSL();
  if (gitBashOpenSSL) {
    console.log('✓ OpenSSL found in Git Bash, generating certificates...');
    opensslCommand = `"${gitBashOpenSSL}"`;
  } else {
    opensslCommand = null;
  }
}

if (opensslCommand) {
  try {
    const command = `${opensslCommand} req -x509 -newkey rsa:2048 -nodes -sha256 -subj "/CN=localhost" ` +
      `-keyout "${keyPath}" -out "${certPath}" -days 365`;
    
    execSync(command, { 
      stdio: 'pipe',
      shell: true
    });
    
    // Verify files were created
    if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
      console.log('');
      console.log('✅ SSL certificates generated successfully!');
      console.log('   Key:  ' + keyPath);
      console.log('   Cert: ' + certPath);
      console.log('');
      console.log('🔒 HTTPS is now enabled by default');
      console.log('   Start server: npm run dev');
      console.log('   Access at: https://localhost:5174');
      console.log('');
      console.log('⚠️  Browser Warning:');
      console.log('   You\'ll see a security warning (self-signed certificate)');
      console.log('   Click "Advanced" → "Proceed to localhost (unsafe)"');
      console.log('   This is normal for local development');
      
      process.exit(0);
    } else {
      throw new Error('Certificate files were not created');
    }
  } catch (error) {
    console.error('✗ OpenSSL command failed:', error.message);
  }
}

// Try mkcert as fallback
if (checkCommand('mkcert')) {
  console.log('✓ mkcert detected, generating certificates...');
  try {
    // Change to certs directory for mkcert
    process.chdir(certsDir);
    
    execSync('mkcert -install', { stdio: 'pipe' });
    execSync(`mkcert -key-file localhost-key.pem -cert-file localhost-cert.pem localhost`, { stdio: 'pipe' });
    
    console.log('');
    console.log('✅ SSL certificates generated successfully with mkcert!');
    console.log('   Key:  ' + keyPath);
    console.log('   Cert: ' + certPath);
    console.log('');
    console.log('🔒 HTTPS is now enabled by default');
    console.log('   Start server: npm run dev');
    console.log('   Access at: https://localhost:5174');
    console.log('');
    console.log('✨ No browser warning with mkcert!');
    console.log('   mkcert installs a trusted local certificate authority');
    
    process.exit(0);
  } catch (error) {
    console.error('✗ mkcert command failed');
  }
}

// Neither tool is available, provide instructions
console.error('');
console.error('❌ Could not generate SSL certificates');
console.error('   OpenSSL and mkcert are not available');
console.error('');
console.error('📦 Installation Options:');
console.error('');
console.error('Option 1: Install Git for Windows (Recommended)');
console.error('  → Includes OpenSSL automatically');
console.error('  → Download: https://git-scm.com/download/win');
console.error('  → After install, run: npm run generate-certs');
console.error('');
console.error('Option 2: Install mkcert (Easier, no browser warnings)');
console.error('  → Windows (with Chocolatey):');
console.error('    choco install mkcert');
console.error('  → Windows (with Scoop):');
console.error('    scoop bucket add extras');
console.error('    scoop install mkcert');
console.error('  → Or download from: https://github.com/FiloSottile/mkcert/releases');
console.error('  → After install, run: npm run generate-certs');
console.error('');
console.error('Option 3: Manual OpenSSL Installation');
console.error('  → Download: https://slproweb.com/products/Win32OpenSSL.html');
console.error('  → Install "Win64 OpenSSL v3.x.x Light"');
console.error('  → Add to PATH: C:\\Program Files\\OpenSSL-Win64\\bin');
console.error('  → After install, run: npm run generate-certs');
console.error('');
console.error('🔧 Quick Start Without HTTPS:');
console.error('   The web interface requires HTTPS, but you can manually');
console.error('   create certificates or use a different setup method.');
console.error('');

process.exit(1);


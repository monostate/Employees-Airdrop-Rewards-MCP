import fs from 'fs';

// Make server.js executable
try {
  fs.chmodSync('build/server.js', 0o755);
  console.log('Made build/server.js executable');
} catch (err) {
  console.error(`Error making server.js executable: ${err.message}`);
}

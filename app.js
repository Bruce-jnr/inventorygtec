// CommonJS entry point for cPanel/Passenger; backend modules use ES modules.
import('./backend/server.js').catch((error) => {
  console.error('Student Inventory startup failed:', error.code || error.name);
  if (
    error.code === 'ERR_MODULE_NOT_FOUND' ||
    error.code === 'MODULE_NOT_FOUND'
  ) {
    // Import errors identify the missing package/file; no environment values are logged.
    console.error(error.message);
    console.error(
      'From the application root, run: npm --prefix backend install --omit=dev',
    );
    console.error(
      'Also confirm cPanel points to the folder containing app.js and backend/server.js.',
    );
  }
  process.exitCode = 1;
});

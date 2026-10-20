// CommonJS entry point for cPanel/Passenger; backend modules use ES modules.
import('./backend/server.js').catch((error) => {
  console.error('Student Inventory startup failed:', error.code || error.name);
  process.exitCode = 1;
});

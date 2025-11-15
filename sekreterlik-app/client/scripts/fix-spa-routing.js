// Post-build script for Render.com SPA routing
// This script copies index.html to common routes after build
const fs = require('fs');
const path = require('path');

// Post-build script - dist directory is always in client/dist
// __dirname is: sekreterlik-app/client/scripts
// So ../dist is: sekreterlik-app/client/dist
const distDir = path.join(__dirname, '..', 'dist');
const indexHtmlPath = path.join(distDir, 'index.html');
const publicDir = path.join(__dirname, '..', 'public');
const publicRedirectsPath = path.join(publicDir, '_redirects');
const distRedirectsPath = path.join(distDir, '_redirects');
const publicStaticJsonPath = path.join(publicDir, 'static.json');
const distStaticJsonPath = path.join(distDir, 'static.json');

console.log('Looking for dist directory at:', distDir);
console.log('Index.html exists:', fs.existsSync(indexHtmlPath));

// Copy _redirects file from public to dist if it exists
if (fs.existsSync(publicRedirectsPath)) {
  fs.copyFileSync(publicRedirectsPath, distRedirectsPath);
  console.log('Copied _redirects file to dist directory');
} else {
  console.warn('_redirects file not found in public directory');
}

// Copy static.json file from public to dist if it exists
if (fs.existsSync(publicStaticJsonPath)) {
  fs.copyFileSync(publicStaticJsonPath, distStaticJsonPath);
  console.log('Copied static.json file to dist directory');
} else {
  console.warn('static.json file not found in public directory');
}

// Routes that need index.html copies
const routes = [
  'members',
  'meetings',
  'events',
  'tasks',
  'archive',
  'settings',
  'regions',
  'districts',
  'towns',
  'neighborhoods',
  'villages',
  'login',
  'dashboard',
  'member-dashboard',
  'clear-all-data',
  'district-president-dashboard',
  'town-president-dashboard',
  'election-preparation',
  'election-preparation/ballot-boxes',
  'election-preparation/observers',
  'election-preparation/representatives',
  'election-preparation/neighborhoods',
  'election-preparation/villages',
  'election-preparation/groups',
  'elections',
  'election-results',
  'chief-observer-login',
  'chief-observer-dashboard',
  'management-chart',
  'calendar',
  'bulk-sms',
  'teşkilat',
  'teşkilat/ilçeler',
  'teşkilat/kadın-kolları',
  'teşkilat/gençlik-kolları'
];

if (!fs.existsSync(indexHtmlPath)) {
  console.error('index.html not found in dist directory');
  process.exit(1);
}

// Read index.html
const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');

// Create index.html copies for each route
routes.forEach(route => {
  const routeDir = path.join(distDir, route);
  const routeIndexPath = path.join(routeDir, 'index.html');
  
  // Create route directory if it doesn't exist
  if (!fs.existsSync(routeDir)) {
    fs.mkdirSync(routeDir, { recursive: true });
  }
  
  // Copy index.html to route directory
  fs.writeFileSync(routeIndexPath, indexHtml);
  console.log(`Created ${route}/index.html`);
});

// For dynamic routes like /election-results/:electionId, create a catch-all
// Create election-results directory with index.html for base route
const electionResultsDir = path.join(distDir, 'election-results');
if (!fs.existsSync(electionResultsDir)) {
  fs.mkdirSync(electionResultsDir, { recursive: true });
}
// Also create a catch-all subdirectory structure
// This ensures /election-results/ANY_ID works
const electionResultsIndexPath = path.join(electionResultsDir, 'index.html');
fs.writeFileSync(electionResultsIndexPath, indexHtml);
console.log('Created election-results/index.html for dynamic routes');

// Create a catch-all directory for any dynamic route under election-results
// This is a workaround for Render.com static hosting
// Note: '*' is not a valid directory name, so we need a different approach
// Instead, we'll create a subdirectory that will catch all routes
// For Render.com, we need to use _redirects file which is already handled above

// Additionally, create a nested structure for common election IDs
// This helps with some hosting providers that don't support wildcards
const commonIds = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
commonIds.forEach(id => {
  const idDir = path.join(electionResultsDir, id);
  if (!fs.existsSync(idDir)) {
    fs.mkdirSync(idDir, { recursive: true });
  }
  const idIndexPath = path.join(idDir, 'index.html');
  fs.writeFileSync(idIndexPath, indexHtml);
  console.log(`Created election-results/${id}/index.html`);
});

console.log('SPA routing files created successfully');


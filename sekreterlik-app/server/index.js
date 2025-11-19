const express = require('express');
const cors = require('cors');
const path = require('path');
const compression = require('compression');
const helmet = require('helmet');
const Sentry = require('@sentry/node');
const { spawn } = require('child_process');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Import routes
console.log('Importing routes...');
const authRouter = require('./routes/auth');
console.log('Auth router imported');
const membersRouter = require('./routes/members');
console.log('Members router imported');
const meetingsRouter = require('./routes/meetings');
console.log('Meetings router imported');
const regionsRouter = require('./routes/regions');
console.log('Regions router imported');
const positionsRouter = require('./routes/positions');
console.log('Positions router imported');
const tasksRouter = require('./routes/tasks');
console.log('Tasks router imported');
const memberRegistrationsRouter = require('./routes/memberRegistrations');
console.log('Member registrations router imported');
const archiveRouter = require('./routes/archive');
console.log('Archive router imported');
const eventsRouter = require('./routes/events');
console.log('Events router imported');
const personalDocumentsRouter = require('./routes/personalDocuments');
console.log('Personal documents router imported');
const districtsRouter = require('./routes/districts');
console.log('Districts router imported');
const townsRouter = require('./routes/towns');
console.log('Towns router imported');
const neighborhoodsRouter = require('./routes/neighborhoods');
console.log('Neighborhoods router imported');
const villagesRouter = require('./routes/villages');
console.log('Villages router imported');
const stksRouter = require('./routes/stks');
console.log('STKs router imported');
const publicInstitutionsRouter = require('./routes/publicInstitutions');
console.log('Public Institutions router imported');
const mosquesRouter = require('./routes/mosques');
console.log('Mosques router imported');
const eventCategoriesRouter = require('./routes/eventCategories');
console.log('Event categories router imported');
const neighborhoodRepresentativesRouter = require('./routes/neighborhoodRepresentatives');
console.log('Neighborhood representatives router imported');
const villageRepresentativesRouter = require('./routes/villageRepresentatives');
console.log('Village representatives router imported');
const neighborhoodSupervisorsRouter = require('./routes/neighborhoodSupervisors');
console.log('Neighborhood supervisors router imported');
const villageSupervisorsRouter = require('./routes/villageSupervisors');
console.log('Village supervisors router imported');
const districtOfficialsRouter = require('./routes/districtOfficials');
console.log('District officials router imported');
const townOfficialsRouter = require('./routes/townOfficials');
console.log('Town officials router imported');
const visitsRouter = require('./routes/visits');
console.log('Visits router imported');
const districtDeputyInspectorsRouter = require('./routes/districtDeputyInspectors');
console.log('District deputy inspectors router imported');
const townDeputyInspectorsRouter = require('./routes/townDeputyInspectors');
console.log('Town deputy inspectors router imported');
const districtManagementMembersRouter = require('./routes/districtManagementMembers');
console.log('District management members router imported');
const townManagementMembersRouter = require('./routes/townManagementMembers');
console.log('Town management members router imported');
const ballotBoxesRouter = require('./routes/ballotBoxes');
console.log('Ballot boxes router imported');
const ballotBoxObserversRouter = require('./routes/ballotBoxObservers');
console.log('Ballot box observers router imported');
const electionsRouter = require('./routes/elections');
console.log('Elections router imported');
const electionResultsRouter = require('./routes/electionResults');
console.log('Election results router imported');
const alliancesRouter = require('./routes/alliances');
console.log('Alliances router imported');
const messagesRouter = require('./routes/messages');
console.log('Messages router imported');
const mongoMessagesRouter = require('./routes/mongoMessages');
console.log('MongoDB messages router imported');
const permissionsRouter = require('./routes/permissions');
console.log('Permissions router imported');
const bylawsRouter = require('./routes/bylaws');
console.log('Bylaws router imported');
const syncRouter = require('./routes/sync');
console.log('Sync router imported');
const pollsRouter = require('./routes/polls');
console.log('Polls router imported');
const financialRouter = require('./routes/financial');
console.log('Financial router imported');
const pushSubscriptionsRouter = require('./routes/pushSubscriptions');
console.log('Push subscriptions router imported');
const memberDashboardAnalyticsRouter = require('./routes/memberDashboardAnalytics');
console.log('Member dashboard analytics router imported');
const dashboardRouter = require('./routes/dashboard');
console.log('Dashboard router imported');
const notificationsRouter = require('./routes/notifications');
console.log('Notifications router imported');
const apiKeysRouter = require('./routes/apiKeys');
console.log('API keys router imported');
const publicApiRouter = require('./routes/publicApi');
console.log('Public API router imported');
const PollController = require('./controllers/PollController');

// Import middleware
const { authenticateToken } = require('./middleware/auth');
const { recordRequest, renderMetrics } = require('./utils/metrics');
const { rateLimit, createRateLimiter } = require('./middleware/rateLimit');
const { cache } = require('./middleware/cache');

// Import MongoDB connection
const { connectToMongoDB } = require('./config/mongodb');

// Initialize Firebase Admin SDK
const { initFirebaseAdmin } = require('./config/firebaseAdmin');
initFirebaseAdmin();

// Import models
const Admin = require('./models/Admin');
const MemberUser = require('./models/MemberUser');
const PersonalDocument = require('./models/PersonalDocument');
const PositionPermission = require('./models/PositionPermission');

const app = express();
const PORT = process.env.PORT || 5000;

console.log('Starting server setup');

// ============================================
// CLEAN CORS - TEK VE BASIT YAPILANDIRMA
// ============================================
const allowedOrigins = [
  'https://yrpilsekreterligi.onrender.com',
  'https://sekreterlik-backend.onrender.com',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];

// Environment variable'dan ekstra origin'ler ekle
const envOrigins = (process.env.CORS_ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
envOrigins.forEach(origin => {
  if (origin && !allowedOrigins.includes(origin)) {
    allowedOrigins.push(origin);
  }
});

// CLEAN CORS - Tek ve basit yapılandırma
app.use(cors({
  origin: function(origin, callback) {
    // No origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    // Allowed origins kontrolü
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    // Development'da localhost'a izin ver
    if (process.env.NODE_ENV !== 'production' && (origin.includes('localhost') || origin.includes('127.0.0.1'))) {
      return callback(null, true);
    }
    
    // Production'da sadece allowed origins
    console.warn('❌ CORS blocked origin:', origin);
    return callback(new Error('CORS blocked: ' + origin));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
}));

// Initialize database models and MongoDB
const MemberDashboardAnalytics = require('./models/MemberDashboardAnalytics');
const Notification = require('./models/Notification');
const ApiKey = require('./models/ApiKey');
Promise.all([
  Admin.init(),
  MemberUser.init(),
  PersonalDocument.init(),
  PositionPermission.init(),
  MemberDashboardAnalytics.init(),
  Notification.init(),
  ApiKey.initTable(),
  connectToMongoDB()
]).then(() => {
  console.log('All models and MongoDB initialized');
  
  // Delete expired notifications on startup and then every 24 hours
  Notification.deleteExpired().catch(err => {
    console.warn('Error deleting expired notifications on startup:', err);
  });
  
  setInterval(() => {
    Notification.deleteExpired().catch(err => {
      console.warn('Error deleting expired notifications:', err);
    });
  }, 24 * 60 * 60 * 1000); // Every 24 hours

  // Scheduled notification service for planned meetings and events
  const ScheduledNotificationService = require('./services/scheduledNotificationService');
  
  // Check scheduled notifications on startup
  ScheduledNotificationService.checkAndSendScheduledNotifications().catch(err => {
    console.warn('Error checking scheduled notifications on startup:', err);
  });
  
  // Check scheduled notifications every 5 minutes
  setInterval(() => {
    ScheduledNotificationService.checkAndSendScheduledNotifications().catch(err => {
      console.warn('Error checking scheduled notifications:', err);
    });
  }, 5 * 60 * 1000); // Every 5 minutes
}).catch((err) => {
  console.error('Error initializing models:', err);
});

// Middleware
// Sentry init (optional) - CORS'tan SONRA
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: 0.1,
  });
  app.use(Sentry.Handlers.requestHandler());
}

// Helmet.js - HTTP security headers (XSS, clickjacking, MIME type sniffing koruması)
// CORS'tan SONRA kullanılmalı - CORS header'larını override etmemesi için
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"], // Tailwind CSS için gerekli
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // React için gerekli
      imgSrc: ["'self'", "data:", "blob:", "https:"], // Firebase Storage ve data URI için
      connectSrc: process.env.NODE_ENV === 'production' 
        ? ["'self'", "https://*.firebaseio.com", "https://*.googleapis.com", "https://*.onrender.com"]
        : ["'self'", "http://localhost:5000", "http://127.0.0.1:5000", "https://*.firebaseio.com", "https://*.googleapis.com"],
      fontSrc: ["'self'", "data:"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null,
    },
  },
  crossOriginEmbedderPolicy: false, // Firebase için gerekli
  crossOriginResourcePolicy: { policy: "cross-origin" }, // Firebase Storage için
  crossOriginOpenerPolicy: false, // CORS için gerekli
}));
// Gzip compression for JSON/text responses (threshold 1KB)
app.use(compression({
  threshold: 1024,
  filter: (req, res) => {
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  },
}));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));
// Basic rate limiting (apply to all APIs)
app.use('/api', rateLimit);
// Stricter login limiter: 10 req / 5 minutes per IP
const loginLimiter = createRateLimiter({ windowMs: 5 * 60 * 1000, max: 10 });

// Correlation ID and request timing
app.use((req, res, next) => {
  const start = Date.now();
  const correlationId = (
    Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10)
  ).slice(0, 16);
  req.correlationId = correlationId;
  res.setHeader('X-Request-ID', correlationId);

  res.on('finish', () => {
    const durationMs = Date.now() - start;
    const routeBase = (req.baseUrl || req.path || '/').split('?')[0];
    const isError = res.statusCode >= 500;
    recordRequest(req.method, routeBase, durationMs, isError);
    try {
      console.log(
        JSON.stringify({
          level: 'info',
          msg: 'http_request',
          method: req.method,
          path: req.originalUrl,
          route: routeBase,
          status: res.statusCode,
          durationMs,
          requestId: correlationId,
        })
      );
    } catch (_) {}
  });

  next();
});

console.log('Middleware configured');

// Register API routes
console.log('Registering API routes');

app.use('/api/auth', (req, res, next) => {
  if (req.path === '/login') return loginLimiter(req, res, next);
  return next();
}, authRouter);
app.use('/api/members', cache(60), membersRouter);
app.use('/api/meetings', cache(60), meetingsRouter);
app.use('/api/regions', cache(10), regionsRouter);
app.use('/api/positions', cache(10), positionsRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/member-registrations', memberRegistrationsRouter);
app.use('/api/archive', archiveRouter);
app.use('/api/events', cache(60), eventsRouter);
app.use('/api/personal-documents', personalDocumentsRouter);
app.use('/api/districts', cache(10), districtsRouter);
app.use('/api/towns', cache(10), townsRouter);
app.use('/api/neighborhoods', neighborhoodsRouter);
app.use('/api/villages', villagesRouter);
app.use('/api/stks', stksRouter);
app.use('/api/public-institutions', publicInstitutionsRouter);
app.use('/api/mosques', mosquesRouter);
app.use('/api/event-categories', eventCategoriesRouter);
app.use('/api/neighborhood-representatives', neighborhoodRepresentativesRouter);
app.use('/api/village-representatives', villageRepresentativesRouter);
app.use('/api/neighborhood-supervisors', neighborhoodSupervisorsRouter);
app.use('/api/village-supervisors', villageSupervisorsRouter);
app.use('/api/district-officials', districtOfficialsRouter);
app.use('/api/town-officials', townOfficialsRouter);
app.use('/api/visits', visitsRouter);
app.use('/api/district-deputy-inspectors', districtDeputyInspectorsRouter);
app.use('/api/town-deputy-inspectors', townDeputyInspectorsRouter);
app.use('/api/district-management-members', districtManagementMembersRouter);
app.use('/api/town-management-members', townManagementMembersRouter);
app.use('/api/ballot-boxes', ballotBoxesRouter);
app.use('/api/ballot-box-observers', ballotBoxObserversRouter);
app.use('/api/elections', electionsRouter);
app.use('/api/election-results', electionResultsRouter);
app.use('/api/alliances', alliancesRouter);
app.use('/api/messages', messagesRouter);
app.use('/api/mongo-messages', mongoMessagesRouter);
app.use('/api/permissions', permissionsRouter);
app.use('/api/bylaws', bylawsRouter);
app.use('/api/sync', syncRouter);
app.use('/api/polls', pollsRouter);
app.use('/api/financial', financialRouter);
app.use('/api/push-subscriptions', pushSubscriptionsRouter);
app.use('/api/member-dashboard-analytics', memberDashboardAnalyticsRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/api-keys', apiKeysRouter);
app.use('/api/public', publicApiRouter);
app.use('/api/public/visitors', require('./routes/visitors'));

console.log('API routes registered');

// Serve static files (photos) with cache headers
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  etag: true,
  maxAge: '7d',
}));

// Main page route
app.get('/', (req, res) => {
  res.json({ 
    message: 'Sekreterlik Uygulaması API Server',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      test: '/api/test',
      auth: '/api/auth',
      members: '/api/members',
      meetings: '/api/meetings',
      events: '/api/events',
      tasks: '/api/tasks'
    }
  });
});

// Test routes at the very end
app.get('/test', (req, res) => {
  console.log('Simple test route called');
  res.json({ message: 'Simple test route working!' });
});

app.get('/api/health', async (req, res) => {
  try {
    const db = require('./config/database');
    const start = Date.now();
    let dbOk = true;
    let dbLatencyMs = null;
    try {
      await db.all('SELECT 1 as ok LIMIT 1');
      dbLatencyMs = Date.now() - start;
    } catch (_) {
      dbOk = false;
      dbLatencyMs = Date.now() - start;
    }
    const mem = process.memoryUsage();
    res.json({
      message: 'Server is running!',
      db: dbOk ? 'ok' : 'error',
      dbLatencyMs,
      uptimeSec: Math.round(process.uptime()),
      rssMB: Math.round(mem.rss / 1024 / 1024),
    });
  } catch (e) {
    res.status(500).json({ message: 'Server is running, DB check failed', error: e.message });
  }
});

// Prometheus metrics endpoint
app.get('/api/metrics', (req, res) => {
  res.setHeader('Content-Type', 'text/plain; version=0.0.4');
  res.send(renderMetrics());
});

app.get('/api/test', (req, res) => {
  console.log('Test route called');
  res.json({ message: 'Test route working!' });
});

// 404 handler (after all routes)
app.use((req, res) => {
  res.status(404).json({ message: 'Bulunamadı', code: 'NOT_FOUND' });
});

// Global error handling middleware
app.use((err, req, res, next) => {
  console.error('Global error handler:', err);
  if (process.env.SENTRY_DSN) {
    Sentry.captureException(err);
  }
  res.status(500).json({ message: 'Sunucu hatası', error: err.message });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  // Optional DB maintenance
  if ((process.env.ENABLE_DB_MAINTENANCE || 'true') === 'true') {
    try {
      const db = require('./config/database');
      // Weekly VACUUM (7 days)
      setInterval(() => {
        db.run('VACUUM');
      }, 7 * 24 * 60 * 60 * 1000);
      // Daily backup using script
      setInterval(() => {
        try {
          const proc = spawn('node', ['scripts/backup-sqlite.js'], {
            cwd: __dirname,
            stdio: 'ignore'
          });
          proc.unref();
        } catch (_) {}
      }, 24 * 60 * 60 * 1000);
      
      // Check and end expired polls every hour
      setInterval(() => {
        PollController.checkAndEndExpiredPolls();
      }, 60 * 60 * 1000);
      
      // Run immediately on startup
      PollController.checkAndEndExpiredPolls();
    } catch (e) {
      console.warn('DB maintenance scheduling failed:', e.message);
    }
  }
});
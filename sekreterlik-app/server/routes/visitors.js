const express = require('express');
const router = express.Router();

// In-memory visitor tracking (optimized for high traffic)
// Structure: { electionId: { visitorId: { timestamp, ipAddress } } }
// Memory optimization: Only store minimal data, cleanup aggressively
const activeVisitors = {};
const MAX_VISITORS_PER_ELECTION = 10000; // Safety limit per election
const INACTIVE_THRESHOLD = 60000; // 60 seconds

// Aggressive cleanup for high traffic scenarios
// Cleanup inactive visitors every 15 seconds (more frequent for high traffic)
setInterval(() => {
  const now = Date.now();
  let totalVisitors = 0;
  
  for (const electionId in activeVisitors) {
    const election = activeVisitors[electionId];
    const visitorIds = Object.keys(election);
    
    // Cleanup inactive visitors
    for (const visitorId of visitorIds) {
      const visitor = election[visitorId];
      if (now - visitor.timestamp > INACTIVE_THRESHOLD) {
        delete election[visitorId];
      }
    }
    
    // Remove empty election objects
    const remainingCount = Object.keys(election).length;
    if (remainingCount === 0) {
      delete activeVisitors[electionId];
    } else {
      totalVisitors += remainingCount;
    }
  }
  
  // Safety: If total visitors exceed reasonable limit, perform aggressive cleanup
  if (totalVisitors > 50000) {
    console.warn(`[Visitors] High visitor count detected: ${totalVisitors}. Performing aggressive cleanup.`);
    // Cleanup visitors inactive for more than 30 seconds
    const aggressiveThreshold = 30000;
    for (const electionId in activeVisitors) {
      const election = activeVisitors[electionId];
      for (const visitorId in election) {
        if (now - election[visitorId].timestamp > aggressiveThreshold) {
          delete election[visitorId];
        }
      }
    }
  }
}, 15000); // Cleanup every 15 seconds (more frequent for high traffic)

// Register a new visitor
router.post('/register', (req, res) => {
  try {
    const { electionId, visitorId, timestamp } = req.body;
    
    if (!electionId || !visitorId) {
      return res.status(400).json({ error: 'electionId and visitorId are required' });
    }
    
    if (!activeVisitors[electionId]) {
      activeVisitors[electionId] = {};
    }
    
    const election = activeVisitors[electionId];
    const currentCount = Object.keys(election).length;
    
    // Safety: Prevent memory overflow
    if (currentCount >= MAX_VISITORS_PER_ELECTION) {
      // If at limit, remove oldest inactive visitor first
      const now = Date.now();
      let oldestVisitorId = null;
      let oldestTimestamp = now;
      
      for (const vid in election) {
        if (election[vid].timestamp < oldestTimestamp) {
          oldestTimestamp = election[vid].timestamp;
          oldestVisitorId = vid;
        }
      }
      
      if (oldestVisitorId) {
        delete election[oldestVisitorId];
      }
    }
    
    // Store minimal data: only timestamp and IP (for rate limiting if needed)
    election[visitorId] = {
      timestamp: timestamp ? Date.parse(timestamp) : Date.now(),
      ipAddress: req.ip || req.headers['x-forwarded-for']?.split(',')[0] || 'unknown'
    };
    
    const count = Object.keys(election).length;
    
    res.json({ 
      success: true, 
      count,
      message: 'Visitor registered' 
    });
  } catch (error) {
    console.error('Error registering visitor:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Unregister a visitor
router.post('/unregister', (req, res) => {
  try {
    const { electionId, visitorId } = req.body;
    
    if (!electionId || !visitorId) {
      return res.status(400).json({ error: 'electionId and visitorId are required' });
    }
    
    if (activeVisitors[electionId] && activeVisitors[electionId][visitorId]) {
      delete activeVisitors[electionId][visitorId];
    }
    
    const count = activeVisitors[electionId] 
      ? Object.keys(activeVisitors[electionId]).length 
      : 0;
    
    res.json({ 
      success: true, 
      count,
      message: 'Visitor unregistered' 
    });
  } catch (error) {
    console.error('Error unregistering visitor:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Heartbeat - update visitor's last activity
router.post('/heartbeat', (req, res) => {
  try {
    const { electionId, visitorId, timestamp } = req.body;
    
    if (!electionId || !visitorId) {
      return res.status(400).json({ error: 'electionId and visitorId are required' });
    }
    
    const now = timestamp ? Date.parse(timestamp) : Date.now();
    
    if (activeVisitors[electionId] && activeVisitors[electionId][visitorId]) {
      // Update existing visitor
      activeVisitors[electionId][visitorId].timestamp = now;
    } else {
      // Re-register if not found (session expired)
      if (!activeVisitors[electionId]) {
        activeVisitors[electionId] = {};
      }
      
      // Check limit before adding
      const election = activeVisitors[electionId];
      if (Object.keys(election).length >= MAX_VISITORS_PER_ELECTION) {
        // Remove oldest inactive visitor
        let oldestVisitorId = null;
        let oldestTimestamp = now;
        
        for (const vid in election) {
          if (election[vid].timestamp < oldestTimestamp) {
            oldestTimestamp = election[vid].timestamp;
            oldestVisitorId = vid;
          }
        }
        
        if (oldestVisitorId) {
          delete election[oldestVisitorId];
        }
      }
      
      activeVisitors[electionId][visitorId] = {
        timestamp: now,
        ipAddress: req.ip || req.headers['x-forwarded-for']?.split(',')[0] || 'unknown'
      };
    }
    
    const count = activeVisitors[electionId] 
      ? Object.keys(activeVisitors[electionId]).length 
      : 0;
    
    res.json({ 
      success: true, 
      count,
      message: 'Heartbeat received' 
    });
  } catch (error) {
    console.error('Error processing heartbeat:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get visitor count for an election
router.get('/count', (req, res) => {
  try {
    const { electionId } = req.query;
    
    if (!electionId) {
      return res.status(400).json({ error: 'electionId is required' });
    }
    
    const count = activeVisitors[electionId] 
      ? Object.keys(activeVisitors[electionId]).length 
      : 0;
    
    res.json({ 
      success: true, 
      count,
      electionId 
    });
  } catch (error) {
    console.error('Error getting visitor count:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all visitor counts (for analytics)
router.get('/all-counts', (req, res) => {
  try {
    const counts = {};
    Object.keys(activeVisitors).forEach(electionId => {
      counts[electionId] = Object.keys(activeVisitors[electionId]).length;
    });
    
    const totalCount = Object.values(counts).reduce((sum, count) => sum + count, 0);
    
    res.json({ 
      success: true, 
      counts,
      totalCount 
    });
  } catch (error) {
    console.error('Error getting all visitor counts:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;


const express = require('express');
const router = express.Router();

// In-memory visitor tracking (can be moved to Redis/database for production)
// Structure: { electionId: { visitorId: lastHeartbeat } }
const activeVisitors = {};

// Cleanup inactive visitors (older than 60 seconds)
setInterval(() => {
  const now = Date.now();
  Object.keys(activeVisitors).forEach(electionId => {
    Object.keys(activeVisitors[electionId]).forEach(visitorId => {
      if (now - activeVisitors[electionId][visitorId] > 60000) {
        delete activeVisitors[electionId][visitorId];
      }
    });
    // Remove empty election objects
    if (Object.keys(activeVisitors[electionId]).length === 0) {
      delete activeVisitors[electionId];
    }
  });
}, 30000); // Cleanup every 30 seconds

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
    
    activeVisitors[electionId][visitorId] = Date.now();
    
    const count = Object.keys(activeVisitors[electionId]).length;
    
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
    
    if (!activeVisitors[electionId]) {
      activeVisitors[electionId] = {};
    }
    
    activeVisitors[electionId][visitorId] = Date.now();
    
    const count = Object.keys(activeVisitors[electionId]).length;
    
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


const MemberDashboardAnalytics = require('../models/MemberDashboardAnalytics');

class MemberDashboardAnalyticsController {
  // Start a new session
  static async startSession(req, res) {
    try {
      const { memberId } = req.body;
      
      if (!memberId) {
        return res.status(400).json({ 
          success: false, 
          message: 'Üye ID gerekli' 
        });
      }

      const session = await MemberDashboardAnalytics.startSession(memberId);
      
      res.json({ 
        success: true, 
        session,
        message: 'Session başlatıldı' 
      });
    } catch (error) {
      console.error('Error starting session:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Session başlatılırken hata oluştu' 
      });
    }
  }

  // Update session (end time, duration, page views)
  static async updateSession(req, res) {
    try {
      const { sessionId } = req.params;
      const { sessionEnd, durationSeconds, pageViews } = req.body;
      
      if (!sessionId) {
        return res.status(400).json({ 
          success: false, 
          message: 'Session ID gerekli' 
        });
      }

      await MemberDashboardAnalytics.updateSession(sessionId, {
        sessionEnd,
        durationSeconds,
        pageViews
      });
      
      res.json({ 
        success: true, 
        message: 'Session güncellendi' 
      });
    } catch (error) {
      console.error('Error updating session:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Session güncellenirken hata oluştu' 
      });
    }
  }

  // Get analytics for a specific member
  static async getByMemberId(req, res) {
    try {
      const { memberId } = req.params;
      
      const analytics = await MemberDashboardAnalytics.getByMemberId(memberId);
      
      res.json({ 
        success: true, 
        analytics 
      });
    } catch (error) {
      console.error('Error getting member analytics:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Analytics alınırken hata oluştu' 
      });
    }
  }

  // Get summary for a specific member
  static async getMemberSummary(req, res) {
    try {
      const { memberId } = req.params;
      
      const summary = await MemberDashboardAnalytics.getMemberSummary(memberId);
      
      res.json({ 
        success: true, 
        summary 
      });
    } catch (error) {
      console.error('Error getting member summary:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Özet alınırken hata oluştu' 
      });
    }
  }

  // Get all analytics (admin only)
  static async getAll(req, res) {
    try {
      const analytics = await MemberDashboardAnalytics.getAll();
      
      res.json({ 
        success: true, 
        analytics 
      });
    } catch (error) {
      console.error('Error getting all analytics:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Analytics alınırken hata oluştu' 
      });
    }
  }

  // Get all summary (admin only)
  static async getAllSummary(req, res) {
    try {
      const summary = await MemberDashboardAnalytics.getAllSummary();
      
      res.json({ 
        success: true, 
        summary 
      });
    } catch (error) {
      console.error('Error getting all summary:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Özet alınırken hata oluştu' 
      });
    }
  }
}

module.exports = MemberDashboardAnalyticsController;


const Notification = require('../models/Notification');

class NotificationController {
  // Get notifications for a member
  static async getByMemberId(req, res) {
    try {
      const { memberId } = req.params;
      const { unreadOnly } = req.query;

      // Ownership check — user can only read their own notifications (or admin reads any)
      if (req.user && req.user.role !== 'admin' && req.user.type !== 'admin' && String(req.user.memberId) !== String(memberId)) {
        return res.status(403).json({ success: false, message: 'Bu bildirimlere erişim yetkiniz yok' });
      }

      const notifications = await Notification.getByMemberId(
        memberId,
        unreadOnly === 'true'
      );
      
      res.json({ 
        success: true, 
        notifications 
      });
    } catch (error) {
      console.error('Error getting notifications:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Bildirimler alınırken hata oluştu' 
      });
    }
  }

  // Get unread count
  static async getUnreadCount(req, res) {
    try {
      const { memberId } = req.params;
      
      const count = await Notification.getUnreadCount(memberId);
      
      res.json({ 
        success: true, 
        count 
      });
    } catch (error) {
      console.error('Error getting unread count:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Okunmamış bildirim sayısı alınırken hata oluştu' 
      });
    }
  }

  // Mark notification as read
  static async markAsRead(req, res) {
    try {
      const { notificationId } = req.params;
      const memberId = req.query.memberId || req.user?.id || req.user?.memberId || null;

      await Notification.markAsRead(notificationId, memberId);

      res.json({
        success: true,
        message: 'Bildirim okundu olarak işaretlendi'
      });
    } catch (error) {
      console.error('Error marking notification as read:', error);
      res.status(500).json({
        success: false,
        message: 'Bildirim işaretlenirken hata oluştu'
      });
    }
  }

  // Mark all as read
  static async markAllAsRead(req, res) {
    try {
      const { memberId } = req.params;
      
      await Notification.markAllAsRead(memberId);
      
      res.json({ 
        success: true, 
        message: 'Tüm bildirimler okundu olarak işaretlendi' 
      });
    } catch (error) {
      console.error('Error marking all as read:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Bildirimler işaretlenirken hata oluştu' 
      });
    }
  }

  // Delete notification
  static async delete(req, res) {
    try {
      const { notificationId } = req.params;
      
      await Notification.delete(notificationId);
      
      res.json({ 
        success: true, 
        message: 'Bildirim silindi' 
      });
    } catch (error) {
      console.error('Error deleting notification:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Bildirim silinirken hata oluştu' 
      });
    }
  }

  // Delete expired notifications (admin only)
  static async deleteExpired(req, res) {
    try {
      const result = await Notification.deleteExpired();
      
      res.json({ 
        success: true, 
        message: `${result.deleted} süresi dolmuş bildirim silindi`,
        deleted: result.deleted
      });
    } catch (error) {
      console.error('Error deleting expired notifications:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Süresi dolmuş bildirimler silinirken hata oluştu' 
      });
    }
  }
}

module.exports = NotificationController;


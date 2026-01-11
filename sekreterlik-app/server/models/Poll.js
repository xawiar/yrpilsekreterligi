class Poll {
  constructor({ id, title, description, type = 'poll', options = [], endDate, status = 'active', createdBy, createdAt, updatedAt }) {
    this.id = id;
    this.title = title;
    this.description = description;
    this.type = type; // 'poll' or 'survey'
    this.options = Array.isArray(options) ? options : (options ? JSON.parse(options) : []);
    this.endDate = endDate;
    this.status = status; // 'active', 'ended', 'cancelled'
    this.createdBy = createdBy;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  static validate(poll) {
    const errors = [];

    if (!poll.title || poll.title.trim().length === 0) {
      errors.push('Anket başlığı zorunludur');
    }

    if (!poll.options || poll.options.length < 2) {
      errors.push('En az 2 seçenek olmalıdır');
    }

    if (!poll.endDate) {
      errors.push('Bitiş tarihi zorunludur');
    } else {
      const endDate = new Date(poll.endDate);
      const now = new Date();
      if (endDate <= now) {
        errors.push('Bitiş tarihi gelecekte olmalıdır');
      }
    }

    return errors;
  }

  isActive() {
    if (this.status !== 'active') return false;
    const endDate = new Date(this.endDate);
    const now = new Date();
    return endDate > now;
  }

  isEnded() {
    if (this.status === 'ended' || this.status === 'cancelled') return true;
    const endDate = new Date(this.endDate);
    const now = new Date();
    return endDate <= now;
  }

  toJSON() {
    return {
      id: this.id,
      title: this.title,
      description: this.description,
      type: this.type,
      options: this.options,
      endDate: this.endDate,
      status: this.status,
      createdBy: this.createdBy,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

module.exports = Poll;


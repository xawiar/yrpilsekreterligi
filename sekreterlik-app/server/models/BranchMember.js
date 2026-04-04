class BranchMember {
  constructor({ id, branch_type, name, tc, phone, position, district_id, created_at }) {
    this.id = id;
    this.branch_type = branch_type; // 'kadin' veya 'genclik'
    this.name = name;
    this.tc = tc;
    this.phone = phone;
    this.position = position;
    this.district_id = district_id;
    this.created_at = created_at;
  }

  static validate(member) {
    const errors = [];

    if (!member.branch_type || !['kadin', 'genclik'].includes(member.branch_type)) {
      errors.push('Kol tipi "kadin" veya "genclik" olmalidir');
    }

    if (!member.name || member.name.trim().length === 0) {
      errors.push('Ad Soyad alani zorunludur');
    }

    return errors;
  }
}

module.exports = BranchMember;

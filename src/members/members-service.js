const bcrypt = require('bcryptjs');
const xss = require('xss');
const MembersService = {
  validatePassword(password) {
    if (password.length <= 3) {
      return 'Password must be 4 characters or more';
    }
    if (password.length >= 11) {
      return 'Password be less than 10 characters';
    }
    if (password.startsWith(' ') || password.endsWith(' ')) {
      return 'Password must not start or end with empty spaces';
    }
    return null;
  },

  getMemberById(db, memberId) {
    return db
      .select(
        'members.id',
        'members.name',
        'members.username',
        'members.user_id',
        'members.household_id',
        'members.total_score',
        'levels_members.level_id'
      )
      .from('members')
      .where('members.id', memberId)
      .join('levels_members', 'levels_members.member_id', '=', 'members.id')
      .groupBy(
        'members.id',
        'members.name',
        'members.username',
        'members.user_id',
        'members.household_id',
        'members.total_score',
        'levels_members.level_id'
      )
      .first();
  },

  hasMemberwithMemberName(db, username) {
    return db('members')
      .where({ username })
      .first()
      .then(member => !!member);
  },

  insertMember(db, newMember) {
    return db
      .insert(newMember)
      .into('members')
      .returning('*')
      .then(([member]) => member);
  },

  deleteMember(db, member_id) {
    return db('members')
      .where('id', member_id)
      .delete();
  },

  hashPassword(password) {
    return bcrypt.hash(password, 12);
  },

  updateMember(db, id, updatedMember) {
    return db('members')
      .where({ id })
      .update(updatedMember)
      .returning('*');
  },

  setMemberLevel(db, member_id) {
    return db
      .insert([{ level_id: 1, member_id: member_id }])
      .into('levels_members')
      .returning('*')
      .then(([member]) => member);
  },
  getLevels(db, member_id) {
    return db
      .select(
        'levels_members.level_id',
        'members.name',
        'members.total_score',
        'levels.badge'
      )
      .from('levels_members')
      .join('levels', 'levels.id', '=', 'levels_members.level_id')
      .join('members', 'members.id', '=', 'levels_members.member_id')
      .where('levels_members.member_id', member_id)
      .groupBy(
        'levels_members.level_id',
        'members.name',
        'members.total_score',
        'levels.badge'
      )
      .first();
  },
};

module.exports = MembersService;

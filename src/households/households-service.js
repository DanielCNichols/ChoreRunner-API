const bcrypt = require('bcryptjs');
const xss = require('xss');

const HouseholdsService = {
  insertHousehold(db, newHousehold) {
    return db
      .insert(newHousehold)
      .into('households')
      .returning('*')
      .then(([household]) => household);
  },

  deleteHousehold(db, id) {
    return db('households')
      .where({ id })
      .first()
      .delete();
  },

  getMembersInHousehold(db, household_id) {
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
      .where('household_id', household_id)
      .join('levels_members', 'levels_members.member_id', '=', 'members.id')
      .groupBy(
        'members.id',
        'members.name',
        'members.username',
        'members.user_id',
        'members.household_id',
        'members.total_score',
        'levels_members.level_id'
      );
  },

  getAssignedTasks(db, householdId, memberId) {
    return db
      .select('*')
      .from('tasks')
      .where('tasks.household_id', householdId)
      .andWhere('tasks.member_id', memberId)
      .andWhere('tasks.status', 'assigned');
  },

  getCompletedTasks(db, householdId, memberId) {
    return db
      .select('*')
      .from('tasks')
      .where('tasks.household_id', householdId)
      .andWhere('tasks.member_id', memberId)
      .andWhere('tasks.status', 'completed');
  },

  getAllHouseholds(db, id) {
    return db
      .select('*')
      .from('households')
      .where('user_id', id);
  },

  serializeMember(member) {
    return {
      id: member.id,
      name: xss(member.name),
      username: xss(member.username),
      household_id: member.household_id,
      user_id: member.user_id,
      total_score: member.total_score,
      level_id: member.level_id,
      pointsToNextLevel: member.pointsToNextLevel,
    };
  },

  serializeHousehold(household) {
    return {
      id: household.id,
      name: xss(household.name),
      user_id: household.user_id,
      members: [],
    };
  },

  updateHouseholdName(db, id, newHousehold) {
    return db
      .from('households')
      .where({ id })
      .update(newHousehold)
      .returning('*');
  },

  //Houshold router
  getById(db, householdId) {
    return db
      .from('households')
      .where('id', householdId)
      .first();
  },

  getHouseholdScores(db, household_id) {
    return db
      .select('members.id', 'members.name', 'members.total_score')
      .from('members')
      .where('members.household_id', household_id)
      .orderBy('members.total_score', 'desc');
  },

  resetHouseholdScores(db, household_id) {
    return db('members')
      .where('members.household_id', household_id)
      .update('total_score', 0);
  },

  resetHouseholdLevels(db, household_id) {
    return db('levels_members')
      .update({ level_id: 1 })
      .whereIn('member_id', function() {
        this.select('id')
          .from('members')
          .where('members.household_id', household_id);
      })
      .returning('*');
  },
};

module.exports = HouseholdsService;

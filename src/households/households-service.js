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
  insertTask(db, newTask) {
    return db
      .insert(newTask)
      .into('tasks')
      .returning('*')
      .then(([res]) => res);
  },
  getAllMembersAllHouseholds(db, user_id) {
    return db
      .select('*')
      .from('members')
      .where('user_id', user_id);
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

  //! This would be for the member dashboard?
  getMemberTasks(db, householdId, memberId) {
    return db
      .select('tasks.id', 'tasks.title', 'tasks.points', 'status')
      .from('tasks')
      .where('tasks.household_id', householdId)
      .andWhere('tasks.status', 'assigned')
      .andWhere('tasks.member_id', memberId)
      .groupBy('tasks.id', 'tasks.title', 'tasks.points', 'status');
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

  //Should return all the tasks for a member
  getAllMemberTasks(db, householdId, memberId) {
    return db
      .select('*')
      .from('tasks')
      .where('tasks.household_id', householdId)
      .andWhere('tasks.member_id', memberId);
  },
  getAllHouseholds(db, id) {
    return db
      .select('*')
      .from('households')
      .where('user_id', id);
  },

  getTaskById(db, id) {
    return db
      .select('*')
      .from('tasks')
      .where('id', id)
      .first();
  },

  //Trying to get a list of tasks for each member.
  getTasksForAll(db, household_id) {
    return db
      .select(
        'tasks.id',
        { member_id: 'members.id' },
        'title',
        'points',
        'name',
        'username',
        'total_score',
        'status'
      )
      .from('tasks')
      .leftJoin('members', 'members.id', 'tasks.member_id')
      .where('members.household_id', household_id);
  },

  parentReassignTaskStatus(db, taskId) {
    return db('tasks')
      .where('id', taskId)
      .update({
        status: 'assigned',
      })
      .returning('*')
      .then(([task]) => task);
  },
  //Daniel: Changed to just update and delete task since we have
  //method for update points already in endpoint.
  parentApproveTaskStatus(db, taskId) {
    return db('tasks')
      .where('id', taskId)
      .delete()
      .returning('*')
      .then(([task]) => task);
  },

  getAllMembers(db, id) {
    return db
      .select('*')
      .from('members')
      .where('household_id', id);
  },

  // getMemberById(db, id) {
  //   return db
  //     .select('*')
  //     .from('members')
  //     .where({ id })
  //     .first();
  // },
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
  updateTask(db, id, updated) {
    return db
      .from('tasks')
      .where('id', id)
      .update(updated)
      .returning('*')
      .then(([res]) => res);
  },

  updateMember(db, id, updatedMember) {
    return db('members')
      .where({ id })
      .update(updatedMember)
      .returning('*');
  },
  //This method is for deleting a task from user's dashboard
  deleteTask(db, taskId) {
    return db('tasks')
      .where('tasks.id', taskId)
      .delete();
  },
  //this method updated the task status to 'completed when the child marks it as done.
  completeTask(db, member_id, household_id, taskId) {
    return db('tasks')
      .where('tasks.member_id', member_id)
      .andWhere('tasks.household_id', household_id)
      .andWhere('tasks.id', taskId)
      .update('status', 'completed')
      .returning('*')
      .then(([task]) => task);
  },
  //For patch method on router "/:id"
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

  getById(db, householdId) {
    return db
      .from('households')
      .where('id', householdId)
      .first();
  },
  //To get scores for the leaderboard
  getHouseholdScores(db, household_id) {
    return db
      .select('members.id', 'members.name', 'members.total_score')
      .from('members')
      .where('members.household_id', household_id)
      .orderBy('members.total_score', 'desc');
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
  //USE THIS TO START THE MEMBER AT LEVEL 1 WHEN CREATING MEMBER
  //MUST RUN AFTER INSERT MEMBER.
  setMemberLevel(db, member_id) {
    return db
      .insert([{ level_id: 1, member_id: member_id }])
      .into('levels_members')
      .returning('*')
      .then(([member]) => member);
  },
  //test update level for user
  updateLevel(db, member_id, newLevel) {
    return db('levels_members')
      .where('levels_members.member_id', member_id)
      .update('level_id', newLevel);
  },
  updatePoints(db, member_id, newPoints) {
    return db('members')
      .where('members.id', member_id)
      .update('total_score', newPoints);
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

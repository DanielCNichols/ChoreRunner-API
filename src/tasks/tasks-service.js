const xss = require('xss');

const TasksService = {
  insertTask(db, newTask) {
    return db
      .insert(newTask)
      .into('tasks')
      .returning('*')
      .then(([res]) => res);
  },

  getTaskById(db, id) {
    return db
      .select('*')
      .from('tasks')
      .where('id', id)
      .first();
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

  parentApproveTaskStatus(db, taskId) {
    return db('tasks')
      .where('id', taskId)
      .delete()
      .returning('*')
      .then(([task]) => task);
  },

  updateTask(db, id, updated) {
    return db
      .from('tasks')
      .where('id', id)
      .update(updated)
      .returning('*')
      .then(([res]) => res);
  },

  deleteTask(db, taskId) {
    return db('tasks')
      .where('tasks.id', taskId)
      .delete();
  },

  completeTask(db, member_id, household_id, taskId) {
    return db('tasks')
      .where('tasks.member_id', member_id)
      .andWhere('tasks.household_id', household_id)
      .andWhere('tasks.id', taskId)
      .update('status', 'completed')
      .returning('*')
      .then(([task]) => task);
  },

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
};

module.exports = TasksService;

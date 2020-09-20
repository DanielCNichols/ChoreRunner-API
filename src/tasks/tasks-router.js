const express = require('express');
const path = require('path');
const { requireAuth } = require('../middleware/jwt-auth');
const { requireMemberAuth } = require('../middleware/member-jwt');
const MemberService = require('../members/members-service');

const xss = require('xss');
const TasksService = require('./tasks-service');
const tasksRouter = express.Router();
const jsonBodyParser = express.json(); //move this to app.us();

/**
 * Post '/'
 * Creates a task and assigns to a member. Returns the task.
 * @param {string} title
 * @param {number} member_id - An id for the assignee
 * @param {number} points
 * @param {number} household_id - a valid houshold id
 *
 */
tasksRouter
  .route('/')
  .all(requireAuth)
  .post(jsonBodyParser, (req, res, next) => {
    let { title, member_id, points, household_id } = req.body;

    if (!title || !member_id || !points || !household_id) {
      return res.status(400).json({
        error: {
          message: 'Task name, points, and member are required.',
        },
      });
    }

    const newTask = {
      title: xss(title),
      household_id,
      member_id,
      points,
    };

    newTask.user_id = req.user.id;

    TasksService.insertTask(req.app.get('db'), newTask)
      .then(result => {
        res
          .status(201)
          // .location(`/api/households/${newTask.user_id}/tasks`)
          .json(result);
      })
      .catch(next);
  });

/**
 * Delete '/:id'
 * Deletes the specified task, returning 204 if successful
 */
tasksRouter
  .route('/:id')
  .all(requireAuth)
  .all(checkTaskExists)
  .delete(async (req, res, next) => {
    try {
      const { id } = req.params;
      await TasksService.deleteTask(req.app.get('db'), id);
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  })

  /**
   * PATCH '/:id/'
   * Updates the specified task
   * @param {number} points
   * @param {string} title
   */
  .patch(jsonBodyParser, async (req, res, next) => {
    try {
      let { points, title } = req.body;
      let { id } = req.params;

      if (!points || !title) {
        return res.status(400).json({
          error: `Points and title are required`,
        });
      }

      let updated = {
        title: xss(title),
        points: xss(points),
      };

      let task = await TasksService.updateTask(req.app.get('db'), id, updated);

      res.status(200).send(task);
    } catch (error) {
      next(error);
    }
  });

/**
 * PATCH ':id/complete'
 * Updates a tasks status to 'completed' when it's assigned member marks it finished.
 */

tasksRouter
  .route('/:id/complete')
  .all(requireMemberAuth)
  .all(checkTaskExists)
  .patch(async (req, res, next) => {
    try {
      let { id } = req.params;
      let task = await TasksService.completeTask(
        req.app.get('db'),
        req.member.id,
        req.member.household_id,
        id
      );

      res.send(task);
    } catch (error) {
      next(error);
    }
  });

/**
   * Patch '/:id/approve'
   * Handles task approval. Removes the task, updates the members points and level if necessary
   * @param {number} points
   * @parm {number} member_id- The member responsible for the task.

   */
tasksRouter
  .route('/:id/approve')
  .all(requireAuth)
  .all(checkTaskExists)
  .patch(jsonBodyParser, async (req, res, next) => {
    try {
      const { points, member_id } = req.body;
      const { id } = req.params;

      //update the task status
      let updateTaskStatus = TasksService.parentApproveTaskStatus(
        req.app.get('db'),
        id
      );

      //get the member's current information
      const { name, total_score, level_id } = await MemberService.getLevels(
        req.app.get('db'),
        member_id
      );

      //calculate their new score, level, and points to the next level up
      let newScore = total_score + points;
      let newLevel = Math.floor(newScore / 10) + 1;
      let pointsToNextLevel = Math.abs((newScore % 10) - 10);

      //prepare to update the score
      let scoreUpdate = TasksService.updatePoints(
        req.app.get('db'),
        member_id,
        newScore
      );

      //If their new level is more than their current level, and is less than 10 (max level), then update.
      let levelUpdate;

      if (newLevel > level_id && level_id <= 10 && newLevel <= 10) {
        levelUpdate = TasksService.updateLevel(
          req.app.get('db'),
          member_id,
          newLevel
        );
      }

      //Make the updates in the db
      await Promise.all([updateTaskStatus, scoreUpdate, levelUpdate]);

      //If the member's level is maxed out, then return MAX
      if (newLevel >= 10) {
        pointsToNextLevel = 'MAX';
      } else if (pointsToNextLevel === 0) {
        pointsToNextLevel = 10;
      }

      res.status(200).json({
        level_id: newLevel,
        name: name,
        total_score: newScore,
        toNextLevel: pointsToNextLevel,
      });
    } catch (error) {
      next(error);
    }
  });

/**
 * PATCH '/:id/reject'
 * Handles task rejection. Updates task status to assigned.
 */
tasksRouter
  .route('/:id/reject')
  .all(requireAuth)
  .all(checkTaskExists)
  .patch(jsonBodyParser, async (req, res, next) => {
    try {
      let { id } = req.params;
      const task = await TasksService.parentReassignTaskStatus(
        req.app.get('db'),
        id
      );

      return res.status(201).json(task);
    } catch (error) {
      next(error);
    }
  });

async function checkTaskExists(req, res, next) {
  try {
    const task = await TasksService.getTaskById(
      req.app.get('db'),
      req.params.id
    );

    if (!task) {
      return res.status(404).json({
        error: 'Task does not exist',
      });
    }

    res.task = task;
    next();
  } catch (error) {
    next(error);
  }
}
module.exports = tasksRouter;

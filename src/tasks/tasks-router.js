const express = require('express');
const path = require('path');
const { requireAuth } = require('../middleware/jwt-auth');
const { requireMemberAuth } = require('../middleware/member-jwt');

const xss = require('xss');
//TODO: This will change in the refactor
const HouseholdsService = require('../households/households-service');

const tasksRouter = express.Router();
const jsonBodyParser = express.json(); //move this to app.us();

//Post: Creates a new Task for a household
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

    HouseholdsService.insertTask(req.app.get('db'), newTask)
      .then(result => {
        res
          .status(201)
          // .location(`/api/households/${newTask.user_id}/tasks`)
          .json(result);
      })
      .catch(next);
  });

tasksRouter
  .route('/:id')
  .all(requireAuth)
  .all(checkTaskExists)
  .delete(async (req, res, next) => {
    try {
      const { id } = req.params;
      await HouseholdsService.deleteTask(req.app.get('db'), id);
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  })
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

      let task = await HouseholdsService.updateTask(
        req.app.get('db'),
        id,
        updated
      );

      res.status(200).send(task);
    } catch (error) {
      next(error);
    }
  });

//Handle member clearing a task.
tasksRouter
  .route('/:id/complete')
  .all(requireMemberAuth)
  .all(checkTaskExists)
  .patch(async (req, res, next) => {
    try {
      let { id } = req.params;
      let task = await HouseholdsService.completeTask(
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

//handles parent approval/rejection
tasksRouter
  .route('/:id/approve')
  .all(requireAuth)
  .all(checkTaskExists)
  .patch(jsonBodyParser, async (req, res, next) => {
    try {
      const { points, member_id } = req.body;
      const { id } = req.params;

      let updateTaskStatus = HouseholdsService.parentApproveTaskStatus(
        req.app.get('db'),
        id
      );

      const { name, total_score, level_id } = await HouseholdsService.getLevels(
        req.app.get('db'),
        member_id
      );

      let newScore = total_score + points;
      let newLevel = Math.floor(newScore / 10) + 1;
      let pointsToNextLevel = Math.abs((newScore % 10) - 10);

      let scoreUpdate = HouseholdsService.updatePoints(
        req.app.get('db'),
        member_id,
        newScore
      );

      let levelUpdate;

      if (newLevel > level_id && level_id <= 10 && newLevel <= 10) {
        levelUpdate = HouseholdsService.updateLevel(
          req.app.get('db'),
          member_id,
          newLevel
        );
      }

      await Promise.all([updateTaskStatus, scoreUpdate, levelUpdate]);
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

//handles parent rejecting the task
tasksRouter
  .route('/:id/reject')
  .all(requireAuth)
  .all(checkTaskExists)
  .patch(jsonBodyParser, async (req, res, next) => {
    try {
      let { id } = req.params;
      const task = await HouseholdsService.parentReassignTaskStatus(
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
    const task = await HouseholdsService.getTaskById(
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

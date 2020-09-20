const express = require('express');
const path = require('path');
const { requireAuth } = require('../middleware/jwt-auth');
const HouseholdsService = require('./households-service');
const { requireMemberAuth } = require('../middleware/member-jwt');
const MembersService = require('../members/members-service');
const xss = require('xss');
const {
  getAllMemberTasks,
  serializeHousehold,
  serializeMember,
} = require('./households-service');
const tasksRouter = require('../tasks/tasks-router');

const householdsRouter = express.Router();
const jsonBodyParser = express.json();

//GET: Returns a list of groups and their members
//Post: Creates a new group
householdsRouter
  .route('/')
  .all(requireAuth)
  .post(jsonBodyParser, async (req, res, next) => {
    const { name } = req.body;
    const user_id = req.user.id;

    if (!name)
      return res.status(400).json({
        error: `Missing name in request body`,
      });

    try {
      const newHousehold = {
        name: xss(name),
        user_id,
      };

      const house = await HouseholdsService.insertHousehold(
        req.app.get('db'),
        newHousehold
      );

      res.status(201).json(serializeHousehold(house));
    } catch (error) {
      next(error);
    }
  })
  .get(async (req, res, next) => {
    try {
      const user_id = req.user.id;

      let households = await HouseholdsService.getAllHouseholds(
        req.app.get('db'),
        user_id
      );

      households.forEach((house, idx) => {
        return (households[idx] = serializeHousehold(house));
      });

      //get all the members in the household and append;
      let membersQueries = households.map(house => {
        return HouseholdsService.getMembersInHousehold(
          req.app.get('db'),
          house.id
        );
      });

      let members = await Promise.all(membersQueries);

      households.forEach((house, idx) => {
        house.members = members[idx];
        house.members.forEach(member => {
          if (member.level_id >= 10) {
            member.pointsToNextLevel = 'MAX';
          } else {
            member.pointsToNextLevel = Math.abs((member.total_score % 10) - 10);
          }

          serializeMember(member);
        });
      });

      res.send(households);
    } catch (error) {
      next(error);
    }
  });

//Delete: Removes a single group
//Patch: Updates group name
householdsRouter
  .route('/:id')
  .all(requireAuth)
  .all(checkHouseholdExists)
  .delete(jsonBodyParser, (req, res, next) => {
    const { id } = req.params;

    HouseholdsService.deleteHousehold(req.app.get('db'), id)
      .then(() => {
        res.status(204).end();
      })
      .catch(next);
  })
  .patch(jsonBodyParser, async (req, res, next) => {
    let user_id = req.user.id;
    const { id } = req.params;
    const { name } = req.body;
    const newHousehold = { name: xss(name) };
    const db = req.app.get('db');
    const householdVals = Object.values(newHousehold).filter(Boolean).length;
    if (householdVals === 0) {
      return res.status(400).json({
        error: {
          message: `Request body must contain household 'name'.`,
        },
      });
    }

    let [updated] = await HouseholdsService.updateHouseholdName(
      db,
      id,
      newHousehold
    );

    return res.status(200).json(updated);
  });

//gets a list of all members in a household, their assigned/completed tasks, and their levels/info.
householdsRouter
  .route('/:id/status')
  .all(requireAuth)
  .get(requireAuth, async (req, res, next) => {
    const { householdId: id } = req.params;
    try {
      let membersList = await HouseholdsService.getMembersInHousehold(
        req.app.get('db'),
        id
      );

      //Iterate over the membersList, and make a call to append task list to the membersList.

      let assignedQueries = membersList.map(member => {
        return HouseholdsService.getAssignedTasks(
          req.app.get('db'),
          id,
          member.id
        );
      });

      let status = 'completed';

      let completedQueries = membersList.map(member => {
        return HouseholdsService.getCompletedTasks(
          req.app.get('db'),
          id,
          member.id,
          status
        );
      });

      let assigned = await Promise.all(assignedQueries);
      let completed = await Promise.all(completedQueries);

      membersList.forEach((member, idx) => {
        member.assignedTasks = assigned[idx];
        member.completedTasks = completed[idx];
        if (member.level_id >= 10) {
          member.pointsToNextLevel = 'MAX';
        } else {
          member.pointsToNextLevel = Math.abs((member.total_score % 10) - 10);
        }
      });

      res.status(200).json(membersList);
    } catch (error) {
      next(error);
    }
  });

//!Keep this here
householdsRouter
  .route('/:id/scores')
  .all(requireAuth)
  .all(checkHouseholdExists)
  .patch(jsonBodyParser, async (req, res, next) => {
    let { id } = req.params;
    try {
      let resetScores = HouseholdsService.resetHouseholdScores(
        req.app.get('db'),
        id
      );

      let resetLevels = HouseholdsService.resetHouseholdLevels(
        req.app.get('db'),
        id
      );

      let getScores = HouseholdsService.getHouseholdScores(
        req.app.get('db'),
        id
      );

      let [, , newScores] = await Promise.all([
        resetScores,
        resetLevels,
        getScores,
      ]);

      return res.status(201).json(newScores);
    } catch (error) {
      next(error);
    }
  });

async function checkHouseholdExists(req, res, next) {
  try {
    const household = await HouseholdsService.getById(
      req.app.get('db'),
      req.params.id
    );

    if (!household) {
      return res.status(404).json({
        error: `Household doesn't exist`,
      });
    }

    res.household = household;
    next();
  } catch (error) {
    next(error);
  }
}

module.exports = householdsRouter;

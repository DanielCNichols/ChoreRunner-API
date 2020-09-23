const express = require('express');
const { requireAuth } = require('../middleware/jwt-auth');
const HouseholdsService = require('./households-service');
const xss = require('xss');
const { serializeHousehold, serializeMember } = require('./households-service');

const householdsRouter = express.Router();
const jsonBodyParser = express.json();

/**
 * @householdsRouter
 */
/**
 * Get '/'
 * Returns a list of all households for the logged in user, along with members in that household. Each household contains a list of members with details for each including their current score, level, and experience points needed to reach the next level.
 */

householdsRouter
  .route('/')
  .all(requireAuth)
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

      let membersQueries = households.map(house => {
        return HouseholdsService.getMembersInHousehold(
          req.app.get('db'),
          house.id
        );
      });

      let members = await Promise.all(membersQueries);

      //Appending the appropriate list of members to each house.
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

      return res.status(200).send(households);
    } catch (error) {
      next(error);
    }
  })

  /**
   * Post '/'
   * Adds a household for the logged in user. Returns the newly created house.
   * @param {sting} name - A name for the household
   * R
   */
  .post(jsonBodyParser, async (req, res, next) => {
    try {
      const { name } = req.body;
      const user_id = req.user.id;

      if (!name)
        return res.status(400).json({
          error: `Missing name in request body`,
        });

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
  });

/**
 * Delete '/:id' - Deletes a household for the currently logged in user
 * @param {number} id - A valid household id number
 * Deletes and responds with 204 if successful.
 */
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

  /**
   * PATCH '/:id' - Updates the household name
   * @param {number} id - A valid household id
   * @param {string} name - An updated name for the household
   */
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

/**
 * Get '/:id/status' - Returns the status of all members within a household
 * @params {number} id - A valid household id
 * Returns a list of members for the household, their completed and assigned tasks, as well as their current scores and levels.
 */
householdsRouter
  .route('/:id/status')
  .all(requireAuth)
  .get(async (req, res, next) => {
    try {
      const { id } = req.params;

      //fetch our list of members for the household
      let membersList = await HouseholdsService.getMembersInHousehold(
        req.app.get('db'),
        id
      );

      let assignedQueries = membersList.map(member => {
        return HouseholdsService.getAssignedTasks(
          req.app.get('db'),
          id,
          member.id
        );
      });

      let completedQueries = membersList.map(member => {
        return HouseholdsService.getCompletedTasks(
          req.app.get('db'),
          id,
          member.id
        );
      });

      let assigned = await Promise.all(assignedQueries);
      let completed = await Promise.all(completedQueries);

      //append the tasks to the member and calculate points to next level
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

/**
 * Patch '/:id/scores' - Handles resetting the scores and levels for all members in a household.
 * @param {number} id - A valid household ID
 */
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

      //pull out the zeroed out scores from the returned promises
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

/**
 *Checks to see if a household exists. Returns 404 if not found.
 */

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

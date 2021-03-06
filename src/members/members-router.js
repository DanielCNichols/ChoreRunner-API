const express = require('express');
const { requireMemberAuth } = require('../middleware/member-jwt');
const { requireAuth } = require('../middleware/jwt-auth');
const path = require('path');
const xss = require('xss');
const MembersService = require('./members-service');
const HouseholdsService = require('../households/households-service');

const membersRouter = express.Router();
const jsonBodyParser = express.json();

/**
 * POST '/'
 * Creates and returns a newly created member
 * @param {string} password
 * @param {string} username
 * @param {string} name
 * @param {number} household_id - a valid household Id
 * @param {number} id = user id (provided by auth middleware)
 */
membersRouter
  .route('/')
  .all(requireAuth)
  .post(jsonBodyParser, async (req, res, next) => {
    try {
      const { password, username, name, household_id } = req.body;
      const { id } = req.user;

      //Validate inputs
      for (const field of ['name', 'username', 'password', 'household_id'])
        if (!req.body[field])
          return res.status(400).json({
            error: `Missing '${field}' in request body`,
          });

      const passwordError = MembersService.validatePassword(password);

      if (passwordError) {
        return res.status(400).json({ error: passwordError });
      }

      const hasMemberwithMemberName = await MembersService.hasMemberwithMemberName(
        req.app.get('db'),
        username
      );

      if (hasMemberwithMemberName) {
        return res.status(400).json({ error: 'Username not available' });
      }

      //If it passes the checks, then hash the password and prepare to insert into db.

      const hashedPassword = await MembersService.hashPassword(password);

      const newMember = {
        username: xss(username),
        password: hashedPassword,
        name: xss(name),
        household_id,
        user_id: id,
      };

      const member = await MembersService.insertMember(
        req.app.get('db'),
        newMember
      );

      await MembersService.setMemberLevel(req.app.get('db'), member.id);

      //Get the newly created member and add pointsToNextLevel = 10.
      let result = await MembersService.getMemberById(
        req.app.get('db'),
        member.id
      );

      result.pointsToNextLevel = 10;

      res
        .status(201)
        .location(path.posix.join(req.originalUrl, `/${member.id}`))
        .json(HouseholdsService.serializeMember(result));
    } catch (error) {
      next(error);
    }
  });

/**
 * DELETE '/:id'
 * Deletes the specified member, provided an authorized user is logged in.
 * @params {number} id = a valid member id
 */
membersRouter
  .route('/:id')
  .all(requireAuth)
  .all(checkMemberExists)
  .delete(jsonBodyParser, async (req, res, next) => {
    try {
      const { id } = req.params;

      await MembersService.deleteMember(req.app.get('db'), id);
      return res.status(204).end();
    } catch (error) {
      next(error);
    }
  })

  /**
   * Patch '/:d'
   * Updates a selected member
   * @param {string} name
   * @param {username} username
   * @param {password} password (optional)
   *
   */
  .patch(jsonBodyParser, async (req, res, next) => {
    const { name, username, password } = req.body;
    const { id } = req.params;

    try {
      //validate user input
      const userData = await MembersService.getMemberById(
        req.app.get('db'),
        id
      );

      const hasMemberwithMemberName = await MembersService.hasMemberwithMemberName(
        req.app.get('db'),
        username
      );

      //Reject if username is already taken
      if (username !== userData.username && hasMemberwithMemberName) {
        return res.status(400).json({ error: `Username already taken.` });
      }

      let updatedMember;

      //If the user is updating their password, hash the new password, else continue with the old password
      if (password) {
        //update password needs to be rehashed
        const hashedPassword = await MembersService.hashPassword(password);

        updatedMember = { name, username, password: hashedPassword };
      } else {
        updatedMember = { name, username };
      }

      const numberOfValues = Object.values(updatedMember).filter(Boolean)
        .length;

      if (numberOfValues === 0) {
        return res.status(400).json({
          error: `Request must contain name, username, password, and`,
        });
      }

      await MembersService.updateMember(req.app.get('db'), id, updatedMember);

      let updated = await MembersService.getMemberById(req.app.get('db'), id);

      return res.status(201).json(updated);
    } catch (error) {
      next(error);
    }
  });

/**
 * GET '/:id/status'
 * Returns a member's level and score stats, assigned/completed tasks, and rankings in their household
 * @param {number} - a valid member id
 */
membersRouter
  .route('/:id/status')
  .all(requireMemberAuth)
  .get(async (req, res, next) => {
    try {
      //Prepare queries for assigned and completed tasks
      let getAssignedTasks = HouseholdsService.getAssignedTasks(
        req.app.get('db'),
        req.member.household_id,
        req.member.id
      );

      let getCompletedTasks = HouseholdsService.getCompletedTasks(
        req.app.get('db'),
        req.member.household_id,
        req.member.id
      );

      //Get levels and badge for the badge component
      let getUserStats = MembersService.getLevels(
        req.app.get('db'),
        req.member.id
      );

      //get information for ranings
      let getRankings = HouseholdsService.getHouseholdScores(
        req.app.get('db'),
        req.member.household_id
      );

      //execute queries
      let [
        assignedTasks,
        completedTasks,
        userStats,
        rankings,
      ] = await Promise.all([
        getAssignedTasks,
        getCompletedTasks,
        getUserStats,
        getRankings,
      ]);

      //Calculate points to the next level based on use's current level and score.
      if (userStats.level_id >= 10) {
        userStats.pointsToNextLevel = 'MAX';
      } else {
        userStats.pointsToNextLevel = Math.abs(
          (userStats.total_score % 10) - 10
        );
      }

      res.status(200).send({
        assignedTasks,
        completedTasks,
        userStats,
        rankings,
      });
    } catch (error) {
      next(error);
    }
  });

/**
 * Checks to see if a member exists. If not found, returns 404
 */
async function checkMemberExists(req, res, next) {
  try {
    const { id } = req.params;

    let member = await MembersService.getMemberById(req.app.get('db'), id);

    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    req.member = member;
    next();
  } catch (error) {
    next(error);
  }
}

module.exports = membersRouter;

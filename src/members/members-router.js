const express = require('express');
const HouseholdsService = require('../households/households-service');
const { requireMemberAuth } = require('../middleware/member-jwt');
const { requireAuth } = require('../middleware/jwt-auth');
const path = require('path');
const xss = require('xss');
const MembersService = require('./members-service');

const membersRouter = express.Router();
const jsonBodyParser = express.json(); //move this to app.us();

//Post: create a new memher
membersRouter
  .route('/')
  .all(requireAuth)
  .post(jsonBodyParser, async (req, res, next) => {
    try {
      const { password, username, name, household_id } = req.body;
      const { id } = req.user;

      for (const field of ['name', 'username', 'password', 'household_id'])
        if (!req.body[field])
          return res.status(400).json({
            error: `Missing '${field}' in request body`,
          });

      const passwordError = MembersService.validatePassword(password);

      if (passwordError) {
        return res.status(400).json({ error: passwordError });
      }

      const hasMemberwithMemberName = await HouseholdsService.hasMemberwithMemberName(
        req.app.get('db'),
        username
      );

      if (hasMemberwithMemberName) {
        return res.status(400).json({ error: 'Username not available' });
      }

      const hashedPassword = await HouseholdsService.hashPassword(password);

      const newMember = {
        username: xss(username),
        password: hashedPassword,
        name: xss(name),
        household_id,
        user_id: id,
      };

      const member = await HouseholdsService.insertMember(
        req.app.get('db'),
        newMember
      );

      await HouseholdsService.setMemberLevel(req.app.get('db'), member.id);

      let result = await HouseholdsService.getMemberById(
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

//TODO: check member exists

membersRouter
  .route('/:id')
  .all(requireAuth)
  .all(checkMemberExists)
  .delete(jsonBodyParser, async (req, res, next) => {
    try {
      const { id } = req.params;

      await HouseholdsService.deleteMember(req.app.get('db'), id);
      return res.status(204).end();
    } catch (error) {
      next(error);
    }
  })

  //!you stopped here
  .patch(jsonBodyParser, async (req, res, next) => {
    const { name, username, password } = req.body;
    const { id } = req.params;

    try {
      //check to see that updated userName isn't a duplicate

      const userData = await HouseholdsService.getMemberById(
        req.app.get('db'),
        id
      );

      const hasMemberwithMemberName = await HouseholdsService.hasMemberwithMemberName(
        req.app.get('db'),
        username
      );

      if (username !== userData.username && hasMemberwithMemberName) {
        return res.status(400).json({ error: `Username already taken.` });
      }

      let updatedMember;

      if (password) {
        //update password needs to be rehashed
        const hashedPassword = await HouseholdsService.hashPassword(password);

        updatedMember = { name, username, password: hashedPassword };
      } else {
        updatedMember = { name, username };
      }

      //Check to see that there are actually values passed to be updated
      const numberOfValues = Object.values(updatedMember).filter(Boolean)
        .length;

      if (numberOfValues === 0) {
        return res.status(400).json({
          error: `Request must contain name, username, password, and`,
        });
      }

      await HouseholdsService.updateMember(
        req.app.get('db'),
        id,
        updatedMember
      );

      let updated = await HouseholdsService.getMemberById(
        req.app.get('db'),
        id
      );

      return res.status(201).json(updated);
    } catch (error) {
      next(error);
    }
  });

//memberstatus
//Returns information about the logged in member, their ranking, level info, and tasks.
membersRouter
  .route('/:id/status')
  .all(requireMemberAuth)
  .get(async (req, res, next) => {
    try {
      //Get all assignedTasks
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
      let getUserStats = HouseholdsService.getLevels(
        req.app.get('db'),
        req.member.id
      );

      //get leaderboard info
      let getRankings = HouseholdsService.getHouseholdScores(
        req.app.get('db'),
        req.member.household_id
      );

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

async function checkMemberExists(req, res, next) {
  try {
    const { id } = req.params;

    let member = await HouseholdsService.getMemberById(req.app.get('db'), id);

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

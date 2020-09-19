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
  .route('/:householdId')
  .all(requireAuth)
  .all(checkHouseholdExists)
  .delete(jsonBodyParser, (req, res, next) => {
    const { householdId } = req.params;

    HouseholdsService.deleteHousehold(req.app.get('db'), householdId)
      .then(() => {
        res.status(204).end();
      })
      .catch(next);
  })
  .patch(jsonBodyParser, async (req, res, next) => {
    let user_id = req.user.id;
    const { householdId } = req.params;
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
      householdId,
      newHousehold
    );

    res.send(updated);
  });

//Get: Retrieves all information for the memberDashboard.
//!will use this for the time being, but this entire set up needs to be refactored
//! This makes more sense as a /members/memberid/status
householdsRouter
  .route('/householdId/members/memberId/tasks')
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

//!Keep this. gets info for the household page
//!MOVE THIS INTO api/members!!
householdsRouter
  .route('/:householdId/members')
  .all(requireAuth)
  .get(requireAuth, async (req, res, next) => {
    const { householdId } = req.params;
    try {
      let membersList = await HouseholdsService.getMembersInHousehold(
        req.app.get('db'),
        householdId
      );

      //Iterate over the membersList, and make a call to append task list to the membersList.

      let assignedQueries = membersList.map(member => {
        return HouseholdsService.getAssignedTasks(
          req.app.get('db'),
          householdId,
          member.id
        );
      });

      let status = 'completed';

      let completedQueries = membersList.map(member => {
        return HouseholdsService.getCompletedTasks(
          req.app.get('db'),
          householdId,
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
  })

  //ADDS A MEMBER TO A HOUSEHOLD
  //!This is slow.
  .post(jsonBodyParser, async (req, res, next) => {
    const { password, username, name } = req.body;
    const user_id = req.user.id;
    const { householdId } = req.params;

    for (const field of ['name', 'username', 'password'])
      if (!req.body[field])
        return res.status(400).json({
          error: `Missing '${field}' in request body`,
        });

    try {
      const passwordError = MembersService.validatePassword(password);

      if (passwordError) return res.status(400).json({ error: passwordError });

      const hasMemberwithMemberName = await HouseholdsService.hasMemberwithMemberName(
        req.app.get('db'),
        username
      );

      if (hasMemberwithMemberName)
        return res.status(400).json({ error: `Username already taken` });

      const hashedPassword = await HouseholdsService.hashPassword(password);

      const newMember = {
        username,
        password: hashedPassword,
        name,
        household_id: householdId,
        user_id,
      };

      const member = await HouseholdsService.insertMember(
        req.app.get('db'),
        newMember
      );

      //Set member level by adding their ID to the  levels_members table
      //This must run after HouseholdService.insertMember, because we need the new member Id.
      await HouseholdsService.setMemberLevel(req.app.get('db'), member.id);

      //Get the newly added member, with level and points

      let result = await HouseholdsService.getMemberById(
        req.app.get('db'),
        member.id
      );

      //set points to next level
      result.pointsToNextLevel = 10;

      res
        .status(201)
        .location(path.posix.join(req.originalUrl, `/${member.id}`))
        .json(HouseholdsService.serializeMember(result));
    } catch (error) {
      next(error);
    }
  })
  //delete members
  //!Take a good look at this one and how the routes are laid out. Why do you need a household ID to delete a member? Why are we getting this id from the body and not the route? Gotta be a better way.
  .delete(jsonBodyParser, (req, res, next) => {
    const { member_id } = req.body;
    HouseholdsService.deleteMember(req.app.get('db'), member_id)
      .then(() => {
        res.status(204).end();
      })
      .catch(next);
  });

householdsRouter
  .route('/:householdId/members/:memberId')
  .all(requireAuth)
  .patch(jsonBodyParser, async (req, res, next) => {
    const { name, username, password } = req.body;
    const { memberId } = req.params;

    try {
      //check to see that updated userName isn't a duplicate

      const userData = await HouseholdsService.getMemberById(
        req.app.get('db'),
        memberId
      );

      const hasMemberwithMemberName = await HouseholdsService.hasMemberwithMemberName(
        req.app.get('db'),
        username
      );

      if (username !== userData.username && hasMemberwithMemberName) {
        return res.status(400).json({ error: `Username already taken.` });
      }

      if (password) {
        //update password needs to be rehashed
        const hashedPassword = await HouseholdsService.hashPassword(password);

        const updatedMember = { name, username, password: hashedPassword };
      } else {
        updatedMember = { name, username };
      }

      //Check to see that there are actually values passed to be updated
      const numberOfValues = Object.values(updatedMember).filter(Boolean)
        .length;

      if (numberOfValues === 0) {
        return res.status(400).json({
          error: `Request must contain name, username, password, or household`,
        });
      }

      await HouseholdsService.updateMember(
        req.app.get('db'),
        memberId,
        updatedMember
      );

      let updated = await HouseholdsService.getMemberById(
        req.app.get('db'),
        memberId
      );

      return res.status(201).json(updated);
    } catch (error) {
      next(error);
    }
  });

//FOR DELETING AND UPDATING A SINGLE HOUSEHOLD.

//GET: GET SCORES FOR HOUSEHOLD => LEADERBOARD
householdsRouter
  .route('/household/scores')
  .get(requireMemberAuth, (req, res, next) => {
    HouseholdsService.getHouseholdScores(
      req.app.get('db'),
      req.member.household_id
    )

      .then(result => {
        res.status(201).json(result);
      })
      .catch(next);
  })

  //RESET BUTTON ROUTE. RESET ALL THE SCORES AND LEVELS FOR EVERYONE IN A HOUSE.
  .patch(requireAuth, jsonBodyParser, async (req, res, next) => {
    let { household_id } = req.body;

    try {
      await HouseholdsService.resetHouseholdScores(
        req.app.get('db'),
        household_id
      );

      await HouseholdsService.resetHouseholdLevels(
        req.app.get('db'),
        household_id
      );

      const newScores = await HouseholdsService.getHouseholdScores(
        req.app.get('db'),
        household_id
      );
      res.status(201).json(newScores);
    } catch (error) {
      next(error);
    }
  });

//GET gets the members current level information
//Post: Adds points and  updates levels/badges
householdsRouter
  .route('/:householdId/tasks/status/:taskId')
  //The get requires member auth because it uses the token from the logged in member.
  //This get grabs information for the currently logged in  member.
  .get(requireMemberAuth, async (req, res, next) => {
    const member_id = req.member.id;

    try {
      const userScores = await HouseholdsService.getLevels(
        req.app.get('db'),
        member_id
      );

      //show distance to next level
      userScores.nextLevel = userScores.level_id * 10 - userScores.total_score;

      res.status(201).send(userScores);
    } catch (error) {
      next(error);
    }
  });

async function checkHouseholdExists(req, res, next) {
  try {
    const household = await HouseholdsService.getById(
      req.app.get('db'),
      req.params.householdId
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

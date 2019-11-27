const express = require('express');
const path = require('path');
const { requireAuth } = require('../middleware/jwt-auth')
const HouseholdsService = require('./households-service');
const {requireMemberAuth} = require('../middleware/member-jwt')
// const shortid = require('shortid');

const householdsRouter = express.Router();
const jsonBodyParser = express.json();

householdsRouter
.post('/', requireAuth, jsonBodyParser, async (req, res, next) => {
  const { name } = req.body;
  const user_id = req.user.id;

  console.log(name, user_id)
 
    if (!name)
       return res.status(400).json({
        error: `Missing name in request body`,
      });

  try {
    //use short id to generate house code
    // let house_code = `${name}` + shortid.generate();
    const newHousehold = {
      name,
      user_id,
    };

    const house = await HouseholdsService.insertHousehold(
      req.app.get('db'),
      newHousehold
    );


    res.status(201).json({
      owner_id: house.user_id,
      id: house.id,
      name: house.name,
      // code: house.house_code,
    });
  } catch (error) {
    next(error);
  }
});

householdsRouter
  .route('/:householdId/tasks')
  .all(requireAuth)
  .post(jsonBodyParser, (req, res, next) => {
    let { user_id, title, member_id, points } = req.body;
    const { householdId } = req.params;

    console.log(householdId);

    if (!title || !member_id || !points) {
      return res.status(400).json({error: {message: 'Missing task name, member id or points in request body'}});
    }
    
    const newTask = {
      title, 
      household_id: householdId,
      // user_id, 
      member_id, 
      points};

    newTask.user_id = req.user.id;
    
    HouseholdsService.insertTask(
      req.app.get('db'),
      newTask
    )
      .then(result => {
        res.status(201).json(result[0]);
      })
      .catch(next);
  })


  //NOTE: THIS ENDPOINT USES THE MEMBER'S AUTHTOKEN, NOT PARAMS. 
  //MIGHT WANT TO FIX THIS BEFORE DEPLOY
  householdsRouter
    .route('/householdId/members/memberId/tasks')
    .all(requireMemberAuth)
    .get((req, res, next) => {
      console.log(req.member)
      HouseholdsService.getMemberTasks(
        req.app.get('db'),
        req.member.household_id,
        req.member.id,
      )
      .then(result => {
        res.status(201).json(result)
      })
      .catch(next)
    })
    .delete(jsonBodyParser, (req, res, next) => {
      const {taskId} =req.body
      console.log(taskId)
      HouseholdsService.completeTask(
        req.app.get('db'),
        req.member.id,
        req.member.household_id,
        taskId
      ).then(() => {
        res.status(204).end()
      })
      .catch(next)
    })

  //delete household? 

  //Update household? 

module.exports = householdsRouter;
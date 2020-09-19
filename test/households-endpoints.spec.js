const { expect } = require('chai');
const knex = require('knex');
const supertest = require('supertest');
const app = require('../src/app');
const {
  seedHouseholds,
  seedMembers,
  makeAuthHeader,
} = require('./test-helpers');
const helpers = require('./test-helpers');

describe('Households Endpoints', function() {
  let db;

  const {
    testUsers,
    testHouseholds,
    testMembers,
    testTasks,
    testLevels,
    testLevels_members,
  } = helpers.makeFixtures();

  const testUser = testUsers[0];

  before('make knex instance', () => {
    db = knex({
      client: 'pg',
      connection: process.env.TEST_DATABASE_URL,
    });
    app.set('db', db);
  });

  before('cleanup', () => helpers.cleanTables(db));
  afterEach('cleanup', () => helpers.cleanTables(db));
  after('disconnect from db', () => db.destroy());

  describe(`GET /api/households`, () => {
    context(`Given no households`, () => {
      before('seed users', () => helpers.seedUsers(db, testUsers));
      it(`responds with 200 and an empty list`, () => {
        return supertest(app)
          .get('/api/households')
          .set('Authorization', helpers.makeAuthHeader(testUser))
          .expect(200)
          .then(res => {
            expect(res.body).to.be.an('array');
            expect(res.body).to.eql([]);
          });
      });
    });
    context(`Given households exist`, () => {
      beforeEach('insert households', () => {
        helpers.seedHouseholds(db, testUsers, testHouseholds);
      });

      afterEach('cleanup', () => helpers.cleanTables(db));

      it(`responds with 200 and an array with all the households`, () => {
        const expectedHouseholds = testHouseholds.map(household =>
          helpers.makeExpectedHousehold(testUsers, household)
        );
        return supertest(app)
          .get('/api/households')
          .set('Authorization', helpers.makeAuthHeader(testUsers[0]))
          .expect(200, expectedHouseholds);
      });
    });

    context(`Given an XSS attack household`, () => {
      const testUser = helpers.makeUsersArray()[1];
      const {
        maliciousHousehold,
        expectedHousehold,
      } = helpers.makeMaliciousHousehold(testUser);

      beforeEach('insert malicious household', () => {
        return helpers.seedMaliciousHousehold(db, testUser, maliciousHousehold);
      });

      it('removes XSS attack content', () => {
        return supertest(app)
          .get(`/api/households`)
          .set('Authorization', helpers.makeAuthHeader(testUser))
          .expect(200)
          .expect(res => {
            expect(res.body[0].name).to.eql(expectedHousehold.name);
          });
      });
    });
  });

  describe('POST /api/households', () => {
    context(`POST tests`, () => {
      beforeEach('seed users', () => helpers.seedUsers(db, testUsers));
      it(`creates a household, responding with 201 and a new household`, () => {
        const newHousehold = {
          name: 'Test',
        };
        return supertest(app)
          .post(`/api/households`)
          .set('Authorization', helpers.makeAuthHeader(testUser))
          .send(newHousehold)
          .expect(201)
          .expect(res => {
            expect(res.body.name).to.eql(newHousehold.name);
            expect(res.body).to.have.property('id');
            expect(res.body).to.have.property('members');
          });
      });

      it('Responds with 400 and error message when name is missing', () => {
        const newHousehold = { name: '' };
        return supertest(app)
          .post('/api/households')
          .set('Authorization', helpers.makeAuthHeader(testUser))
          .send(newHousehold)
          .expect(400)
          .expect(res => {
            expect(res.body.error).to.eql('Missing name in request body');
          });
      });
    });

    context(`Given an XSS attack on household`, () => {
      const testUser = helpers.makeUsersArray()[1];
      const {
        maliciousHousehold,
        expectedHousehold,
      } = helpers.makeMaliciousHousehold(testUser);

      beforeEach('insert malicious household', () => {
        return helpers.seedMaliciousHousehold(db, testUser, maliciousHousehold);
      });

      it('removes XSS attack content from household', () => {
        return supertest(app)
          .post(`/api/households`)
          .set('Authorization', helpers.makeAuthHeader(testUser))
          .send(maliciousHousehold)
          .expect(201)
          .expect(res => {
            expect(res.body.name).to.eql(expectedHousehold.name);
          });
      });
    });
  });

  describe('PATCH /api/households/:id', () => {
    context(`PATCH household endpoint tests`, () => {
      before('seed users', () => helpers.seedUsers(db, testUsers));
      it('responds with 404 if household not found', () => {
        const householdId = 999;
        return supertest(app)
          .patch(`/api/households/${householdId}`)
          .set('Authorization', helpers.makeAuthHeader(testUser))
          .expect(404, { error: `Household doesn't exist` });
      });
    });

    context('Given there are households in the database', () => {
      beforeEach('insert household', () => {
        return helpers.seedChoresTables(
          db,
          testUsers,
          testHouseholds,
          testMembers,
          testTasks
        );
      });
      it('responds with 200 and updates household', () => {
        const idToUpdate = 2;
        const updateHousehold = {
          name: 'Test',
        };
        return supertest(app)
          .patch(`/api/households/${idToUpdate}`)
          .set('Authorization', helpers.makeAuthHeader(testUser))
          .send(updateHousehold)
          .expect(200);
      });
    });
  });

  describe(`DELETE /api/households/:id`, () => {
    before('seed users', () => helpers.seedUsers(db, testUsers));
    context('Given no households', () => {
      it('responds with 404', () => {
        const householdId = 999;
        return supertest(app)
          .delete(`/api/households/${householdId}`)
          .set('Authorization', helpers.makeAuthHeader(testUser))
          .expect(404, { error: `Household doesn't exist` });
      });
    });

    context('Given there are households', () => {
      before('seed households', () =>
        helpers.seedHouseholds(db, testUsers, testHouseholds)
      );

      it('Successfully deletes the household and responds with 204', () => {
        const householdId = testHouseholds[0].id;
        return supertest(app)
          .delete(`/api/households/${householdId}`)
          .set('Authorization', helpers.makeAuthHeader(testUser))
          .expect(204);
      });
    });
  });

  //TODO: MOVE THESE TO THE TASK ENDPOINT TESTS
  describe('POST api/tasks', () => {
    beforeEach('seed households, users, and members', async () => {
      try {
        await seedHouseholds(db, testUsers, testHouseholds);
        await seedMembers(db, testMembers);
      } catch (error) {
        next(error);
      }
    });

    let newTask = {
      title: 'testTask',
      member_id: testMembers[0].id,
      points: 1,
      household_id: 1,
    };

    it('creates a new task successfully', async () => {
      let res = await supertest(app)
        .post(`/api/tasks`)
        .set('Authorization', makeAuthHeader(testUser))
        .send(newTask);

      expect(res.body).to.have.property('id');
    });

    it('removes xss content', async () => {
      let malicious = { ...newTask, title: 'Why tho?<script>alert()</script>' };
      let res = await supertest(app)
        .post(`/api/tasks`)
        .set('Authorization', makeAuthHeader(testUser))
        .send(malicious);

      expect(res.body.title).to.eql(
        'Why tho?&lt;script&gt;alert()&lt;/script&gt;'
      );
    });

    let wrongTask = { ...newTask };

    Object.keys(wrongTask).forEach(field => {
      it('rejects with 400 if name, points, or member_id is missing', async () => {
        delete wrongTask[field];

        let res = await supertest(app)
          .post(`/api/tasks`)
          .set('Authorization', makeAuthHeader(testUser))
          .send(wrongTask);

        expect(res.body.error.message).to.eql(
          'Task name, points, and member are required.'
        );
      });
    });
  });

  describe('/api/tasks/:id', () => {
    beforeEach('seed members, users, tasks, and households', async () => {
      await helpers.seedChoresTables(
        db,
        testUsers,
        testHouseholds,
        testMembers,
        testTasks
      );
    });

    describe('DELETE /tasks/:id', () => {
      let householdId = testHouseholds[0].id;
      let taskId = testTasks[0].id;
      it('successfully deletes a task', async () => {
        let res = await supertest(app)
          .delete(`/api/tasks/${taskId}`)
          .set('Authorization', makeAuthHeader(testUser));

        expect(res.status).to.eql(204);
      });

      it('rejects with 404 if task does not exist', async () => {
        let res = await supertest(app)
          .delete(`/api/tasks/90000`)
          .set('Authorization', makeAuthHeader(testUser));

        expect(res.status).to.eql(404);
      });
    });

    describe('Patch /tasks/:taskId', () => {
      let householdId = testHouseholds[0].id;
      let taskId = testTasks[0].id;

      let updatedTask = {
        title: 'updated',
        points: 11,
      };

      it('successfully updates a task', async () => {
        let res = await supertest(app)
          .patch(`/api/tasks/${taskId}`)
          .set('Authorization', makeAuthHeader(testUser))
          .send(updatedTask);

        expect(res.body.title).to.eql(updatedTask.title);
        expect(res.body.points).to.eql(updatedTask.points);
      });

      let botchedUpdate = { ...updatedTask };

      Object.keys(botchedUpdate).forEach(field => {
        delete botchedUpdate[field];
        it('rejects with 400 when a field is missing', async () => {
          let res = await supertest(app)
            .patch(`/api/tasks/${taskId}`)
            .set('Authorization', makeAuthHeader(testUser))
            .send(botchedUpdate);

          expect(res.body.error).to.eql('Points and title are required');
        });
      });
    });
  });

  describe('/api/tasks/:id/complete', () => {
    beforeEach('seed members, users, tasks, and households', async () => {
      await helpers.seedChoresTables(
        db,
        testUsers,
        testHouseholds,
        testMembers,
        testTasks
      );
    });

    describe('Patch /:id/complete', () => {
      let taskId = testTasks[0].id;
      let testMember = testMembers[0];

      it('successfully updates the task status to completed', async () => {
        let res = await supertest(app)
          .patch(`/api/tasks/${taskId}/complete`)
          .set('Authorization', makeAuthHeader(testMember));

        expect(res.body.status).to.eql('completed');
      });

      it('rejects marking complete if task does not exist', async () => {
        let res = await supertest(app)
          .patch(`/api/tasks/80000/complete`)
          .set('Authorization', makeAuthHeader(testMember));

        expect(res.status).to.eql(404);
      });
    });
  });

  describe('/api/tasks/:id/approve', () => {
    beforeEach('seed members, users, tasks, and households', async () => {
      await helpers.seedChoresTables(
        db,
        testUsers,
        testHouseholds,
        testMembers,
        testTasks,
        testLevels,
        testLevels_members
      );
    });

    describe('Patch /:id/approve', () => {
      let taskId = testTasks[0].id;
      let task = {
        points: 2,
        name: testMembers[0].name,
        member_id: testMembers[0].id,
      };

      it.only('successfully updates the task status to approved', async () => {
        let res = await supertest(app)
          .patch(`/api/tasks/${taskId}/approve`)
          .set('Authorization', makeAuthHeader(testUser))
          .send(task);

        expect(res.body).to.have.property('total_score');
        expect(res.body).to.have.property('name');
        expect(res.body).to.have.property('level_id');
        expect(res.body).to.have.property('toNextLevel');
      });

      it.only('rejects marking complete if task does not exist', async () => {
        let res = await supertest(app)
          .patch(`/api/tasks/80000/approve`)
          .set('Authorization', makeAuthHeader(testUser));

        expect(res.status).to.eql(404);
      });
    });
  });

  describe('/api/tasks/:id/reject', () => {
    beforeEach('seed members, users, tasks, and households', async () => {
      await helpers.seedChoresTables(
        db,
        testUsers,
        testHouseholds,
        testMembers,
        testTasks,
        testLevels,
        testLevels_members
      );
    });

    describe('Patch /:id/reject', () => {
      let taskId = testTasks[0].id;

      it.only('successfully updates the task status to assigned', async () => {
        let res = await supertest(app)
          .patch(`/api/tasks/${taskId}/reject`)
          .set('Authorization', makeAuthHeader(testUser));

        expect(res.body.status).to.eql('assigned');
      });

      // it.only('rejects marking complete if task does not exist', async () => {
      //   let res = await supertest(app)
      //     .patch(`/api/tasks/80000/approve`)
      //     .set('Authorization', makeAuthHeader(testUser));

      //   expect(res.status).to.eql(404);
      // });
    });
  });
});

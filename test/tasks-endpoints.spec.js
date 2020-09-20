const { expect } = require('chai');
const { expectCt } = require('helmet');
const knex = require('knex');
const supertest = require('supertest');
const app = require('../src/app');
const { getAssignedTasks } = require('../src/households/households-service');
const {
  seedHouseholds,
  seedMembers,
  makeAuthHeader,
} = require('./test-helpers');
const helpers = require('./test-helpers');

describe('Tasks endpoints', () => {
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

    describe('Patch tasks/:id/complete', () => {
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

      it('successfully updates the task status to approved', async () => {
        let res = await supertest(app)
          .patch(`/api/tasks/${taskId}/approve`)
          .set('Authorization', makeAuthHeader(testUser))
          .send(task);

        expect(res.body).to.have.property('total_score');
        expect(res.body).to.have.property('name');
        expect(res.body).to.have.property('level_id');
        expect(res.body).to.have.property('toNextLevel');
      });

      it('rejects marking complete if task does not exist', async () => {
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

    describe('Patch tasks/:id/reject', () => {
      let taskId = testTasks[0].id;

      it('successfully updates the task status to assigned', async () => {
        let res = await supertest(app)
          .patch(`/api/tasks/${taskId}/reject`)
          .set('Authorization', makeAuthHeader(testUser));

        expect(res.body.status).to.eql('assigned');
      });

      it('rejects marking status assigned if task does not exist', async () => {
        let res = await supertest(app)
          .patch(`/api/tasks/80000/reject`)
          .set('Authorization', makeAuthHeader(testUser));

        expect(res.status).to.eql(404);
      });
    });
  });
});

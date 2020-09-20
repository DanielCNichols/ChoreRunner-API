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

describe('Members endpoints', () => {
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

  describe('/api/members/', () => {
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

    describe('post api/members', () => {
      let newMember = {
        name: 'daniel',
        username: 'daniel123',
        password: 'Pass123',
        household_id: 1,
      };

      it('creates a new member successfully', async () => {
        let res = await supertest(app)
          .post(`/api/members`)
          .set('Authorization', makeAuthHeader(testUser))
          .send(newMember);

        expect(res.body).to.have.property('id');
        expect(res.body.name).to.eql(newMember.name);
        expect(res.body.username).to.eql(newMember.username);
        expect(res.body.total_score).to.eql(0);
        expect(res.body.level_id).to.eql(1);
        expect(res.body.pointsToNextLevel).to.eql(10);
      });

      let requiredFields = ['name', 'username', 'password', 'household_id'];

      requiredFields.forEach(field => {
        let botchedMember = { ...newMember };
        delete botchedMember[field];
        it(`rejects adding a new member and responds with 400 if ${field} is missing`, async () => {
          let res = await supertest(app)
            .post('/api/members')
            .set('Authorization', makeAuthHeader(testUser))
            .send(botchedMember);

          expect(res.status).to.eql(400);
          expect(res.body.error).to.eql(`Missing '${field}' in request body`);
        });
      });
    });
  });

  describe('/api/members/:id', () => {
    let memberId = testMembers[0].id;
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

    describe('delete api/members/:id', () => {
      it('deletes a member successfully', async () => {
        let res = await supertest(app)
          .delete(`/api/members/${memberId}`)
          .set('Authorization', makeAuthHeader(testUser));

        expect(res.status).to.eql(204);
      });

      it('rejects with 404 if member not found', async () => {
        let res = await supertest(app)
          .delete(`/api/members/${memberId}`)
          .set('Authorization', makeAuthHeader(testUser));

        expect(res.status).to.eql(204);
      });
    });

    describe('Patch /api/members/:id', () => {
      let memberId = testMembers[0].id;
      let updatedMember = {
        name: 'updated',
        username: 'updated',
        password: 'newPass',
      };

      it('updates a member successfully', async () => {
        let res = await supertest(app)
          .patch(`/api/members/${memberId}`)
          .set('Authorization', makeAuthHeader(testUser))
          .send(updatedMember);

        expect(res.body.name).to.eql(updatedMember.name);
      });
    });
  });

  describe('/api/housholds/:id/scores', () => {
    let household_id = testHouseholds[0].id;
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

    describe('patch api/households/:id/scores', () => {
      it('resets all scores for the household', async () => {
        let res = await supertest(app)
          .patch(`/api/households/${household_id}/scores`)
          .set('Authorization', makeAuthHeader(testUser));

        res.body.forEach(member => {
          expect(member.total_score).to.eql(0);
        });
      });
    });
  });

  describe('/api/members/status', () => {
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

    describe('get api/members/account/status', () => {
      let testMember = testMembers[0];
      let id = testMember.id;
      it('returns the members info, ranking, and tasks', async () => {
        let res = await supertest(app)
          .get(`/api/members/${id}/status`)
          .set('Authorization', makeAuthHeader(testMember));

        expect(res.body).to.have.property('assignedTasks');
        expect(res.body.assignedTasks).to.be.an('array');
        expect(res.body).to.have.property('completedTasks');
        expect(res.body.assignedTasks).to.be.an('array');
        expect(res.body).to.have.property('userStats');
        expect(res.body.userStats).to.have.property('level_id');
        expect(res.body.userStats).to.have.property('name');
        expect(res.body.userStats).to.have.property('total_score');
        expect(res.body.userStats).to.have.property('badge');
        expect(res.body.userStats).to.have.property('pointsToNextLevel');
        expect(res.body).to.have.property('rankings');
        expect(res.body.rankings).to.be.an('array');
      });
    });
  });
});

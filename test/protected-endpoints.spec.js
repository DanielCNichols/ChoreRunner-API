const knex = require('knex');
const supertest = require('supertest');
const app = require('../src/app');
const helpers = require('./test-helpers');

describe('Protected endpoints', function() {
  let db;

  const {
    testUsers,
    testHouseholds,
    testMembers,
    testTasks,
  } = helpers.makeFixtures();

  before('make knex instance', () => {
    db = knex({
      client: 'pg',
      connection: process.env.TEST_DATABASE_URL,
    });
    app.set('db', db);
  });

  after('disconnect from db', () => db.destroy());

  before('cleanup', async () => await helpers.cleanTables(db));

  afterEach('cleanup', async () => await helpers.cleanTables(db));

  beforeEach('insert tables', async () => {
    await helpers.seedChoresTables(
      db,
      testUsers,
      testHouseholds,
      testMembers,
      testTasks
    );
  });

  const userProtectedEndpoints = [
    // GET and POST households
    {
      name: 'GET /api/households',
      path: '/api/households',
      method: supertest(app).get,
    },
    {
      name: 'POST /api/households',
      path: '/api/households',
      method: supertest(app).post,
    },
    //PATCH  and DELETE households
    {
      name: 'DELETE /api/households/:id',
      path: `/api/households/${testHouseholds[0].id}`,
      method: supertest(app).patch,
    },
    {
      name: 'DELETE /api/households/:id',
      path: `/api/households/${testHouseholds[0].id}`,
      method: supertest(app).delete,
    },

    //Get household status
    {
      name: 'GET /api/households/:id/status',
      path: `/api/households/${testHouseholds[0].id}/status`,
      method: supertest(app).get,
    },

    //reset scores
    {
      name: 'Patch /api/households/:id',
      path: `/api/households/${testHouseholds[0].id}/scores`,
      method: supertest(app).patch,
    },
    //POST household tasks
    {
      name: 'Post /api/tasks',
      path: '/api/tasks',
      method: supertest(app).post,
    },

    //Delete and Update tasks
    {
      name: 'DELETE /api/tasks/:id',
      path: `/api/tasks/${testTasks[0].id}`,
      method: supertest(app).delete,
    },
    {
      name: 'PATCH /api/tasks/:id',
      path: `/api/tasks/${testTasks[0].id}`,
      method: supertest(app).patch,
    },

    //parent task approval/rejection
    {
      name: 'PATCH /api/tasks/:id/approve',
      path: `/api/tasks/${testTasks[0].id}/approve`,
      method: supertest(app).patch,
    },
    {
      name: 'PATCH /api/tasks/:id/reject',
      path: `/api/tasks/${testTasks[0].id}/reject`,
      method: supertest(app).patch,
    },

    // POSTs a member to a household
    {
      name: 'POST /api/members',
      path: '/api/members',
      method: supertest(app).post,
    },

    //delete and update members
    {
      name: 'DELETE /api/members/:id',
      path: `/api/members/${testMembers[0].id}`,
      method: supertest(app).delete,
    },
    {
      name: 'Patch /api/members/:id',
      path: `/api/members/${testMembers[0].id}`,
      method: supertest(app).patch,
    },
  ];

  const memberProtectedEndpoints = [
    //handle clearing task
    {
      name: 'PATCH /api/tasks/:id/complete',
      path: `/api/tasks/${testTasks[0].id}/complete`,
      method: supertest(app).patch,
    },
  ];

  userProtectedEndpoints.forEach(endpoint => {
    describe(endpoint.name, () => {
      it("responds 401 'Missing bearer token' when no bearer token", () => {
        return endpoint
          .method(endpoint.path)
          .expect(401, { error: 'Missing bearer token' });
      });

      it("responds 401 'Unauthorized request' when invalid JWT secret", () => {
        const validUser = testUsers[0];
        const invalidSecret = 'bad-secret';
        return endpoint
          .method(endpoint.path)
          .set(
            'Authorization',
            helpers.makeAuthHeader(validUser, invalidSecret)
          )
          .expect(401, { error: 'Unauthorized request' });
      });

      it("responds 401 'Unauthorized request' when invalid sub in payload", () => {
        const invalidUser = { username: 'user-not-existy', id: 1 };
        return endpoint
          .method(endpoint.path)
          .set('Authorization', helpers.makeAuthHeader(invalidUser))
          .expect(401, { error: 'Unauthorized request' });
      });
    });
  });

  memberProtectedEndpoints.forEach(endpoint => {
    describe(endpoint.name, () => {
      it("responds 401 'Missing bearer token' when no bearer token", () => {
        return endpoint
          .method(endpoint.path)
          .expect(401, { error: 'Missing bearer token' });
      });

      it("responds 401 'Unauthorized request' when invalid JWT secret", () => {
        const validUser = testUsers[0];
        const invalidSecret = 'bad-secret';
        return endpoint
          .method(endpoint.path)
          .set(
            'Authorization',
            helpers.makeAuthHeader(validUser, invalidSecret)
          )
          .expect(401, { error: 'Unauthorized request' });
      });

      it("responds 401 'Unauthorized request' when invalid sub in payload", () => {
        const invalidUser = { username: 'user-not-existy', id: 1 };
        return endpoint
          .method(endpoint.path)
          .set('Authorization', helpers.makeAuthHeader(invalidUser))
          .expect(401, { error: 'Unauthorized request' });
      });
    });
  });
});

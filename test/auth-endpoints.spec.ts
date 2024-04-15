import knex, { Knex } from 'knex'
import app from '../src/app'
import jwt from 'jsonwebtoken'
import * as helpers from './test-helpers'
import config from '../src/config'
import supertest from 'supertest'

//TODO: move these types somewhere else
export type LoginBody = {
  username: string
  password: string
}

export type LoginFields = keyof LoginBody


describe('Auth Endpoints', function () {
  let db: Knex;

  const { testUsers } = helpers.makeFixtures();
  const testUser = testUsers[0];

  before('make knex instance', () => {
    db = knex({
      client: 'pg',
      connection: process.env.TEST_DATABASE_URL,
    });
    app.set('db', db);
  });

  after('disconnect from db', () => db.destroy());

  before('cleanup', () => helpers.cleanTables(db));

  afterEach('cleanup', () => helpers.cleanTables(db));

  describe(`POST /api/auth/token`, () => {
    beforeEach('insert users', () => helpers.seedUsers(db, testUsers));

    const requiredFields: LoginFields[] = ['username', 'password'];

    requiredFields.forEach(field => {
      const loginAttemptBody: LoginBody = {
        username: testUser.username,
        password: testUser.password,
      };

      it(`responds with 400 required error when '${field}' is missing`, () => {
        delete loginAttemptBody[field];

        return supertest(app)
          .post('/api/auth/token')
          .send(loginAttemptBody)
          .expect(400, {
            error: `Missing '${field}' in request body`,
          });
      });
    });

    it(`responds 400 'invalid username or password' when bad username`, () => {
      const userInvalidUser = { username: 'not-exist', password: 'hehe' };
      return supertest(app)
        .post('/api/auth/token')
        .send(userInvalidUser)
        .expect(400, { error: 'Incorrect username or password' });
    });

    it(`responds 400 'invalid username or password' when bad password`, () => {
      const userInvalidPass = { username: testUser, password: 'incorrect' };
      return supertest(app)
        .post('/api/auth/token')
        .send(userInvalidPass)
        .expect(400, { error: `Incorrect username or password` });
    });

    it(`responds 200 and JWT auth token using secret when valid credentials`, () => {
      const userValidCreds = {
        username: testUser.username,
        password: testUser.password,
        type: 'user',
      };

      const expectedToken = jwt.sign(
        { user_id: testUser.id, name: testUser.name, type: 'user' }, //payload
        config.JWT_SECRET,
        {
          subject: testUser.username,
          expiresIn: config.JWT_EXPIRY,
          algorithm: 'HS256',
        }
      );
      return supertest(app)
        .post('/api/auth/token')
        .send(userValidCreds)
        .expect(200, {
          authToken: expectedToken,
          type: 'user',
        });
    });
  });
});

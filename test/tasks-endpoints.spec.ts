import { expect } from 'chai'
import knex from 'knex'
import supertest from 'supertest'
import app from '../src/app'
import {
  seedHouseholds,
  seedMembers,
  makeAuthHeader,
  makeFixtures,
  cleanTables,
  seedChoresTables,
  Task
} from './test-helpers'




describe('Tasks endpoints', () => {
  let db: Knex;

  const {
    testUsers,
    testHouseholds,
    testMembers,
    testTasks,
    testLevels,
    testLevels_members,
  } = makeFixtures();

  const testUser = testUsers[0];

  before('make knex instance', () => {
    db = knex({
      client: 'pg',
      connection: process.env.TEST_DATABASE_URL,
    });
    app.set('db', db);
  });

  before('cleanup', () => cleanTables(db));
  afterEach('cleanup', () => cleanTables(db));
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

    const newTask = {
      title: 'testTask',
      member_id: testMembers[0].id,
      points: 1,
      household_id: 1,
    };

    it('creates a new task successfully', async () => {
      const res = await supertest(app)
        .post(`/api/tasks`)
        .set('Authorization', makeAuthHeader(testUser))
        .send(newTask);

      expect(res.body).to.have.property('id');
    });

    it('removes xss content', async () => {
      const malicious = { ...newTask, title: 'Why tho?<script>alert()</script>' };
      const res = await supertest(app)
        .post(`/api/tasks`)
        .set('Authorization', makeAuthHeader(testUser))
        .send(malicious);

      expect(res.body.title).to.eql(
        'Why tho?&lt;script&gt;alert()&lt;/script&gt;'
      );
    });

    const wrongTask: Partial<Task> = { ...newTask };

    Object.keys(wrongTask).forEach(field => {
      it('rejects with 400 if name, points, or member_id is missing', async () => {
        delete wrongTask[field];

        const res = await supertest(app)
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
      await seedChoresTables(
        db,
        testUsers,
        testHouseholds,
        testMembers,
        testTasks
      );
    });

    describe('DELETE /tasks/:id', () => {
      const householdId = testHouseholds[0].id;
      const taskId = testTasks[0].id;
      it('successfully deletes a task', async () => {
        const res = await supertest(app)
          .delete(`/api/tasks/${taskId}`)
          .set('Authorization', makeAuthHeader(testUser));

        expect(res.status).to.eql(204);
      });

      it('rejects with 404 if task does not exist', async () => {
        const res = await supertest(app)
          .delete(`/api/tasks/90000`)
          .set('Authorization', makeAuthHeader(testUser));

        expect(res.status).to.eql(404);
      });
    });

    describe('Patch /tasks/:taskId', () => {
      const householdId = testHouseholds[0].id;
      const taskId = testTasks[0].id;

      const updatedTask = {
        title: 'updated',
        points: 11,
      };

      it('successfully updates a task', async () => {
        const res = await supertest(app)
          .patch(`/api/tasks/${taskId}`)
          .set('Authorization', makeAuthHeader(testUser))
          .send(updatedTask);

        expect(res.body.title).to.eql(updatedTask.title);
        expect(res.body.points).to.eql(updatedTask.points);
      });

      const botchedUpdate = { ...updatedTask };

      Object.keys(botchedUpdate).forEach(field => {
        delete botchedUpdate[field];
        it('rejects with 400 when a field is missing', async () => {
          const res = await supertest(app)
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
      await seedChoresTables(
        db,
        testUsers,
        testHouseholds,
        testMembers,
        testTasks
      );
    });

    describe('Patch tasks/:id/complete', () => {
      const taskId = testTasks[0].id;
      const testMember = testMembers[0];

      it('successfully updates the task status to completed', async () => {
        const res = await supertest(app)
          .patch(`/api/tasks/${taskId}/complete`)
          .set('Authorization', makeAuthHeader(testMember));

        expect(res.body.status).to.eql('completed');
      });

      it('rejects marking complete if task does not exist', async () => {
        const res = await supertest(app)
          .patch(`/api/tasks/80000/complete`)
          .set('Authorization', makeAuthHeader(testMember));

        expect(res.status).to.eql(404);
      });
    });
  });

  describe('/api/tasks/:id/approve', () => {
    beforeEach('seed members, users, tasks, and households', async () => {
      await seedChoresTables(
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
      const taskId = testTasks[0].id;
      const task = {
        points: 2,
        name: testMembers[0].name,
        member_id: testMembers[0].id,
      };

      it('successfully updates the task status to approved', async () => {
        const res = await supertest(app)
          .patch(`/api/tasks/${taskId}/approve`)
          .set('Authorization', makeAuthHeader(testUser))
          .send(task);

        expect(res.body).to.have.property('total_score');
        expect(res.body).to.have.property('name');
        expect(res.body).to.have.property('level_id');
        expect(res.body).to.have.property('toNextLevel');
      });

      it('rejects marking complete if task does not exist', async () => {
        const res = await supertest(app)
          .patch(`/api/tasks/80000/approve`)
          .set('Authorization', makeAuthHeader(testUser));

        expect(res.status).to.eql(404);
      });
    });
  });

  describe('/api/tasks/:id/reject', () => {
    beforeEach('seed members, users, tasks, and households', async () => {
      await seedChoresTables(
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
      const taskId = testTasks[0].id;

      it('successfully updates the task status to assigned', async () => {
        const res = await supertest(app)
          .patch(`/api/tasks/${taskId}/reject`)
          .set('Authorization', makeAuthHeader(testUser));

        expect(res.body.status).to.eql('assigned');
      });

      it('rejects marking status assigned if task does not exist', async () => {
        const res = await supertest(app)
          .patch(`/api/tasks/80000/reject`)
          .set('Authorization', makeAuthHeader(testUser));

        expect(res.status).to.eql(404);
      });
    });
  });
});

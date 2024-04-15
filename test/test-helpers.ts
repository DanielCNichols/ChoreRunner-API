import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { Knex } from 'knex';

export interface User {
  id: number,
  username: string,
  password: string,
  name: string
}

function makeUsersArray(): User[] {
  return [
    {
      id: 1,
      username: 'test-user-1',
      password: 'password',
      name: 'Test user 1',
    },
    {
      id: 2,
      username: 'test-user-2',
      password: 'password',
      name: 'Test user 2',
    },
    {
      id: 3,
      username: 'test-user-3',
      password: 'password',
      name: 'Test user 3',
    },
    {
      id: 4,
      username: 'test-user-4',
      password: 'password',
      name: 'Test user 4',
    },
  ];
}

export interface Household {
  id: number,
  name: string,
  user_id: number
}

function makeHouseholdsArray(): Household[] {
  return [
    {
      id: 1,
      name: 'household1',
      user_id: 1,
    },
    {
      id: 2,
      name: 'household2',
      user_id: 1,
    },
    {
      id: 3,
      name: 'household3',
      user_id: 1,
    },
    {
      id: 4,
      name: 'household4',
      user_id: 1,
    },
  ];
}

export interface HouseholdMember {
  id: number,
  name: string,
  username: string,
  password: string,
  user_id: number,
  household_id: number,
  total_score: number
}

function makeMembersArray(): HouseholdMember[] {
  return [
    {
      id: 1,
      name: 'kid1',
      username: 'kid1',
      password: 'kid1',
      user_id: 1,
      household_id: 1,
      total_score: 20,
    },
    {
      id: 2,
      name: 'kid2',
      username: 'kid2',
      password: 'kid2',
      user_id: 1,
      household_id: 1,
      total_score: 5,
    },
    {
      id: 3,
      name: 'kid3',
      username: 'kid3',
      password: 'kid3',
      user_id: 1,
      household_id: 1,
      total_score: 30,
    },
    {
      id: 4,
      name: 'kid4',
      username: 'kid4',
      password: 'kid4',
      user_id: 1,
      household_id: 1,
      total_score: 0,
    },
  ];
}

export enum TaskStatus {
  ASSIGNED = 'assigned',
  COMPLETED = 'completed',
  APPROVED = 'approved'
}

export interface Task {
  id: number,
  title: string,
  household_id: number,
  user_id: number,
  member_id: number,
  points: number,
  status: TaskStatus,
}

function makeTasksArray(): Task[] {
  return [
    {
      id: 1,
      title: 'task1',
      household_id: 1,
      user_id: 1,
      member_id: 1,
      points: 4,
      status: TaskStatus.ASSIGNED,
    },
    {
      id: 2,
      title: 'task2',
      household_id: 1,
      user_id: 1,
      member_id: 1,
      points: 3,
      status: TaskStatus.COMPLETED,
    },
    {
      id: 3,
      title: 'task3',
      household_id: 1,
      user_id: 1,
      member_id: 3,
      points: 2,
      status: TaskStatus.COMPLETED,
    },
    {
      id: 4,
      title: 'task4',
      household_id: 1,
      user_id: 1,
      member_id: 4,
      points: 1,
      status: TaskStatus.APPROVED,
    },
  ];
}

export interface Level {
  id: number,
  badge: string
}

function makeLevelsArray(): Level[] {
  return [
    {
      id: 1,
      badge: 'badge1',
    },
    {
      id: 2,
      badge: 'badge2',
    },
    {
      id: 3,
      badge: 'badge3',
    },
  ];
}

export interface LevelMember {
  id: number,
  member_id: number,
  level_id: number
}

function makeLevelsMembers(): LevelMember[] {
  return [
    {
      id: 1,
      member_id: 1,
      level_id: 1,
    },
    {
      id: 2,
      member_id: 2,
      level_id: 1,
    },
  ];
}

function makeExpectedHousehold(users: User[], household: Household) {
  const user = users.find(user => user.id === household.user_id);

  return {
    id: household.id,
    name: household.name,
    user_id: household.user_id,
    members: [],
  };
}

function makeExpectedHouseholdTask(users: User[], householdId: number, tasks: Task[]) {
  const expectedTasks = tasks.filter(task => task.id === householdId);

  return expectedTasks.map(task => {
    const userTask = users.find(user => user.id === task.user_id);
    return {
      id: task.id,
      title: task.title,
      household_id: task.household_id,
      user_id: task.user_id,
      member_id: task.member_id,
      points: task.points,
      status: task.status,
    };
  });
}

/* -- Seeding -- */

function seedUsers(db: Knex, users: User[]) {
  const preppedUsers = users.map(user => ({
    ...user,
    password: bcrypt.hashSync(user.password, 1),
  }));

  return db
    .into('users')
    .insert(preppedUsers)
    .then(() =>
      // update the auto sequence to stay in sync
      db.raw(`SELECT setval('users_id_seq', ?)`, [users[users.length - 1].id])
    );
}

function seedHouseholds(db: Knex, users: User[], households: Household[]) {
  return db.transaction(async trx => {
    await seedUsers(trx, users);
    await trx.into('households').insert(households);
    await trx.raw(`SELECT setval('households_id_seq', ?)`, [
      households[households.length - 1].id,
    ]);
  });
}

// This only works if seedUsers and seedHouseholds has been run.
function seedMembers(db: Knex, members: HouseholdMember[]) {
  return db.transaction(async trx => {
    await trx.into('members').insert(members);
    await trx.raw(`SELECT setval('members_id_seq', ?)`, [
      members[members.length - 1].id,
    ]);
  });
}

function seedTasks(db: Knex, tasks: Task[]) {
  return db.transaction(async trx => {
    await trx.into('tasks').insert(tasks);
    await trx.raw(`SELECT setval('tasks_id_seq', ?)`, [
      tasks[tasks.length - 1].id,
    ]);
  });
}

function seedChoresTables(
  db,
  users: User[] = [],
  households: Household[] = [],
  members: HouseholdMember[] = [],
  tasks: Task[] = [],
  levels: Level[] = [],
  levels_members: LevelMember[] = []
) {
  return db.transaction(async (trx: any) => {
    await trx.into('users').insert(users);
    await trx.raw(`SELECT setval('users_id_seq', ?)`, [
      users[users.length - 1].id,
    ]);

    if (households.length) {
      await trx.into('households').insert(households);
      await trx.raw(`SELECT setval('households_id_seq', ?)`, [
        households[households.length - 1].id,
      ]);
    }

    if (members.length) {
      await trx.into('members').insert(members);
      await trx.raw(`SELECT setval('members_id_seq', ?)`, [
        members[members.length - 1].id,
      ]);
    }

    if (tasks.length) {
      await trx.into('tasks').insert(tasks);
      await trx.raw(`SELECT setval('tasks_id_seq', ?)`, [
        tasks[tasks.length - 1].id,
      ]);
    }

    if (levels.length) {
      await trx.into('levels').insert(levels);
      await trx.raw(`SELECT setval('levels_id_seq', ?)`, [
        levels[levels.length - 1].id,
      ]);
    }
    if (levels_members.length) {
      await trx.into('levels_members').insert(levels_members);
      await trx.raw(`SELECT setval('levels_members_id_seq', ?)`, [
        levels_members[levels_members.length - 1].id,
      ]);
    }
  });
}

function cleanTables(db: Knex) {
  return db.transaction(async (trx: any) => {
    await trx.raw(`TRUNCATE tasks RESTART IDENTITY CASCADE`);
    await trx.raw(`TRUNCATE members RESTART IDENTITY CASCADE`);
    await trx.raw(`TRUNCATE households RESTART IDENTITY CASCADE`);
    await trx.raw(`TRUNCATE users RESTART IDENTITY CASCADE`);
    await trx.raw(`TRUNCATE levels RESTART IDENTITY CASCADE`);
    await trx.raw(`TRUNCATE levels_members RESTART IDENTITY CASCADE`);
  });
}

function makeAuthHeader(user: User, secret: string | undefined = process.env.JWT_SECRET) {
  const token = jwt.sign({ user_id: user.id }, secret as string, {
    subject: user.username,
    algorithm: 'HS256',
  });
  return `Bearer ${token}`;
}

function makeFixtures() {
  const testUsers = makeUsersArray();
  const testHouseholds = makeHouseholdsArray();
  const testMembers = makeMembersArray();
  const testTasks = makeTasksArray();
  const testLevels = makeLevelsArray();
  const testLevels_members = makeLevelsMembers();
  return {
    testUsers,
    testHouseholds,
    testMembers,
    testTasks,
    testLevels,
    testLevels_members,
  };
}

/* ---XSS test helpers---*/

function makeMaliciousHousehold(user: User) {
  return {
    maliciousHousehold: {
      id: 1,
      name: 'A Foul Name <script>alert("xss");</script>',
      user_id: user.id,
    },
    expectedHousehold: {
      id: 1,
      name: 'A Foul Name &lt;script&gt;alert("xss");&lt;/script&gt;',
      user_id: user.id,
    },
  };
}

function seedMaliciousHousehold(db: Knex, user: User, household: Household) {
  return seedHouseholds(db, [user], [household]);
}

//Creates a malicious task and its expected outcome.
function makeMaliciousTask(user: User, household: Household, member: HouseholdMember) {
  const mockTask = {
    id: 1,
    title: null,
    household_id: household.id,
    user_id: user.id,
    member_id: member.id,
    points: 10,
    status: 'assigned',
  },
    maliciousString = 'A Foul Name <script>alert("xss");</script>',
    expectedString = 'A Foul Name &lt;script&gt;alert("xss");&lt;/script&gt;';

  return {
    maliciousTask: { ...mockTask, title: maliciousString },
    expectedTask: { ...mockTask, title: expectedString },
  };
}

function seedMaliciousTask(db: Knex, user: User, household: Household, member: HouseholdMember, task: Task) {
  seedHouseholds(db, [user], [household])
    .then(() => {
      return seedMembers(db, [member]);
    })
    .then(() => {
      return seedTasks(db, [task]);
    });
}

export {
  cleanTables,
  seedUsers,
  seedHouseholds,
  seedMembers,
  seedTasks,
  seedChoresTables,
  seedMaliciousHousehold,
  seedMaliciousTask,
  makeMaliciousHousehold,
  makeMaliciousTask,
  makeUsersArray,
  makeHouseholdsArray,
  makeMembersArray,
  makeTasksArray,
  makeLevelsArray,
  makeLevelsMembers,
  makeFixtures,
  makeExpectedHousehold,
  makeExpectedHouseholdTask,
  makeAuthHeader,
};

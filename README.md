# ChoreRunner API 1.1

Authors: Daniel Nichols, Hubert Yang, Chitchanok Nancy Phiukhao, Yulia Khisamutdinova, Alexander Fukui

This project was created using Express, Node, and PostgreSQL.

## Tech stack

- NodeJS
- Express
- PostgresQL

## Set up

Complete the following steps to start a new project (NEW-PROJECT-NAME):

1. Clone this repository to your local machine `git clone BOILERPLATE-URL NEW-PROJECTS-NAME`
2. `cd` into the cloned repository
3. Make a fresh start of the git history for this project with `rm -rf .git && git init`
4. Install the node dependencies `npm install`
5. Move the example Environment file to `.env` that will be ignored by git and read by the express server `mv example.env .env`
6. Edit the contents of the `package.json` to use NEW-PROJECT-NAME instead of `"name": "express-boilerplate",`

## Scripts

Start the application `npm start`

Start nodemon for the application `npm run dev`

Run the tests `npm test`

## API Documentation

### Authorized Endpoints

All endpoints using the `requireAuth` or `requireMemberAuth` middleware require a hashed bearer token in the header. A user/member should be logged in to use this endpoint appropriately, and most of these endpoints require this authorization. The server uses jsonwebtoken and bcryptjs to parse and encrypt this token to prevent data collisions and provide security for the users.

---

### Households

These endpoints manipulate the status of households, which group together family members. All require authorization.

#### GET api/households

Returns a list of all households for the logged in user, along iwth members in that household. Each household contains a list of members with details for each including their current score, level, and experience points needed to reach the next level.

```json
[
  {
    "id": 58,
    "name": "Simpsons",
    "user_id": 1,
    "members": [
      {
        "id": 66,
        "name": "Bart",
        "username": "bartman",
        "user_id": 1,
        "household_id": 58,
        "total_score": 35,
        "level_id": 4,
        "pointsToNextLevel": 5
      },
      {
        "id": 67,
        "name": "Lisa",
        "username": "saxmansTestifying",
        "user_id": 1,
        "household_id": 58,
        "total_score": 0,
        "level_id": 1,
        "pointsToNextLevel": 10
      }
    ]
  }
]
```

#### POST api/households

The api creates a new household associated with the parent. It requires a "name" value to be passed in the request body. Returns the newly created household.

```json
//POST api/households
//Body: {"name": "Simpsons","
//returns...

{
  "id": 71,
  "name": "Simpsons",
  "user_id": 1,
  "members": []
}
```

#### DELETE /api/households/:householdId

Deletes a household associated with the currently logged in user. Requires a valid Id in request parameters. Responds with 204 if successful.

#### PATCH /api/households/:householdId

Updates the name of a given household associated with the currently logged in user. Requires a valid id in request parameters. Responds with the updated household.

```json
{
  "id": 72,
  "name": "yeet",
  "user_id": 1
}
```

#### GET /api/households/:id/status

Returns a list of members in a household, their completed and assigned tasks, as well as their current scores and levels. Requires a valid household Id.

```json
[
    {
        "id": 66,
        "name": "Bart",
        "username": "bartman",
        "user_id": 1,
        "household_id": 58,
        "total_score": 0,
        "level_id": 1,
        "assignedTasks": [
          {
            "title": "Clean Room",
            "points": "12",
            "status": "assigned",
            "id": "1",
            "user_id": "1"
            "member_id": "66"
          }
        ],
        "completedTasks": [
          {
            "title": "Feed santa's little helper",
            "points": '5',
            "status": "completed",
            "id": "2",
            "user_id": "1",
            member_id: "66"
          }
        ],
        "pointsToNextLevel": 10
    },
    {
        "id": 67,
        "name": "Lisa",
        "username": "saxmanTestifying",
        "user_id": 1,
        "household_id": 58,
        "total_score": 0,
        "level_id": 1,
        "assignedTasks": [],
        "completedTasks": [],
        "pointsToNextLevel": 10
    },
]
```

#### PATCH api/housholds/:id/scores

Handles resetting the scores and levels for all memebrs in a household. Returns members and their zero'd out scores.

```json
[
  {
    "id": 67,
    "name": "Bart",
    "total_score": 0
  },
  {
    "id": 69,
    "name": "Lisa",
    "total_score": 0
  }
]
```

### Members

The members route handles accessing and manipulating members and their current status. It requires authorization either as a parent user (requireAuth) or member (requireMemberAuth) where noted.

#### Post api/members (requireAuth)

Creates and returns a newly created member associated with the currently logged in user. . Requires a member name, username, password, and a household_id the member is associated with.

```json
//body: {
// password: 'pass123',
// username: 'duffman2020',
// name: 'duffman',
// household_id: 58
//  }

//response
{
  "id": 72,
  "name": "duffman",
  "username": "duffman2020",
  "household_id": 58,
  "user_id": 1,
  "total_score": 0,
  "level_id": 1,
  "pointsToNextLevel": 10
}
```

#### Delete api/members/:id (requireAuth)

Deletes the specified member, provided a user is logged in. Requires a valid member id in the request parameters. Responds with 204 if successful.

#### PATCH api/members/:id (requireAuth)

Updates the specified member, provided a user is logged in. Returns the updated member.

```json
{
  "id": 72,
  "name": "Homer",
  "username": "Homer1234",
  "user_id": 1,
  "household_id": 58,
  "total_score": 0,
  "level_id": 1
}
```

GET api/members/:id/status (requireMemberAuth)

Returns the currently logged-in member's level, scores, assigned/completed tasks, and rankings in their household.

```json
{
  "assignedTasks": [],
  "completedTasks": [],
  "userStats": {
    "level_id": 1,
    "name": "bart",
    "total_score": 0,
    "badge": "Badge1",
    "pointsToNextLevel": 10
  },
  "rankings": [
    {
      "id": 67,
      "name": "lisa",
      "total_score": 0
    },
    {
      "id": 69,
      "name": "maggie",
      "total_score": 0
    },
    {
      "id": 66,
      "name": "homer",
      "total_score": 0
    },
    {
      "id": 72,
      "name": "bart",
      "total_score": 0
    }
  ]
}
```

### Tasks

The tasks route handles creation, deletion, and updating of tasks, as well as task approval and rejection by a parent user. Access to these endpoints are restricted to either a logged in user (requireAuth) or member(requireMemberAuth) where noted.

#### Post /api/tasks (requireAuth)

Creates a task and assigns it to a member. Returns the newly completed task. Requires title, member_id, points, and household_id in the request body.

```json
//Body: {title: 'pick up moe', member_id: 72, points: 20, household_id: 58}

{
  "id": 170,
  "title": "get moe",
  "household_id": 58,
  "user_id": 1,
  "member_id": 72,
  "points": 20,
  "status": "assigned"
}
```

#### DELETE /api/tasks/:id (requireAuth)

Deletes the specified task, returning 204 if successful. Requires a valid task id in the request parameters.

#### PATCH /api/tasks/:id (requireAuth)

Used to update the specified task name and points. Reuqires a valid task id in the request parameters, and points or title fields in the request body.

```json
//Body: {"title": "feed maggie", "points": 2}
{
  "id": 170,
  "title": "get maggie",
  "household_id": 58,
  "user_id": 1,
  "member_id": 72,
  "points": 12,
  "status": "assigned"
}
```

#### PATCH /api/tasks/:id/approve (requireAuth)

Handles task approval, removing the task, updating the appropriate member's points and level if necessary. Requires a valid task id in the request parameters, as well as points and member_id in the request body. Returns the updated member's scores and level information.

```json
//Body: {points: 12, member_id: 72}

{
  "level_id": 2,
  "name": "Bart",
  "total_score": 12,
  "toNextLevel": 8
}
```

#### PATCH /api/task/:id/reject (requireAuth)

Handles rejecting a completed task, updating task status to "assigned". Requires a valid task id in the request parameters. Returns the updated task.

```json
{
  "id": 171,
  "title": "Get money",
  "household_id": 58,
  "user_id": 1,
  "member_id": 72,
  "points": 12,
  "status": "assigned"
}
```

#### PATCH /api/tasks/:id/complete (requireMemberAuth)

Marks a task completed for the currently logged in member. Requires a valid task id in the request parameters. Note: this request will NOT update a member's score. All updates to the member's standings and ranking occur after a parent has approved the task. Returns the task.

```json
{
  "id": 171,
  "title": "Get money",
  "household_id": 58,
  "user_id": 1,
  "member_id": 72,
  "points": 12,
  "status": "completed"
}
```

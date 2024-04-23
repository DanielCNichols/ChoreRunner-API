import express, {Request, Response, NextFunction} from 'express'
import morgan from 'morgan'
import cors from 'cors'
import helmet from 'helmet'
import { NODE_ENV, CLIENT_ORIGIN } from './config';
import authRouter from './auth/auth-router';
import userRouter from './user/user-router';
import membersRouter from './members/members-router';
import membersAuthRouter from './auth-members/members-auth';
import householdsRouter from './households/households-router';
import tasksRouter from './tasks/tasks-router';

const app = express();

const morganSetting = NODE_ENV === 'production' ? 'tiny' : 'common';

app.use(morgan(morganSetting));
app.use(helmet());
app.use(
  cors({
    origin: CLIENT_ORIGIN,
  })
);

app.use('/api/auth', authRouter);
app.use('/api/users', userRouter);
app.use('/api/households', householdsRouter);
app.use('/api/membersAuth', membersAuthRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/members', membersRouter);
app.use('/test', (req:Request, res:Response, next:NextFunction) => {
  res.json({status: 'OK'}).status(200)
})
app.use(function errorHandler(error:Error, req:Request, res:Response, next:NextFunction) {
  let response;
  if (NODE_ENV === 'production') {
    response = { error: { message: 'server error' } };
  } else {
    console.error(error);
    response = { message: error.message, error };
  }
  res.status(500).json(response);
});

export default app

import express from "express";
import morgan from "morgan";
import dotenv from "dotenv";
import passport from 'passport';
import swaggerUi from 'swagger-ui-express';
import cors from 'cors';
import path from 'path';
import flash from 'connect-flash';
import ejsMate from 'ejs-mate';
import session from 'express-session';
import redis from 'redis';
import redisConnect from 'connect-redis';
import strategy from './lib/passportLocal'
import openApiDocumentation from '../openApiDocumentation.json';
import apiRouter from "./routes";
import errorHandler from "./lib/globalErrorHandler";
import models from './models'
import logger from './lib/logger';
dotenv.config();


require('./services/paymentService')
strategy(passport)
const app = express();

// template engine 
app.engine('ejs', ejsMate);
app.set('view engine', 'ejs')

// static files 
app.use(express.static(path.resolve(__dirname, '../public/dist')))

// body parser and logger 
app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({
  extended: false
}));

// Express session
let RedisStore = redisConnect(session)
let redisClient = redis.createClient(process.env.REDIS_URL)
app.use(
  session({
    secret: 'secret',
    resave: true,
    saveUninitialized: true,
    store: new RedisStore({
      client: redisClient
    })
  })
);

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());

// app.use(cookieParser());
app.use(cors())

// Connect flash
app.use(flash());

// Global variables
app.use((req, res, next) => {
  res.locals.success_msg = req.flash('success_msg');
  res.locals.error_msg = req.flash('error_msg');
  res.locals.error = req.flash('error');
  next();
});


app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openApiDocumentation));

app.use(apiRouter);

app.all("*", async (req, res, next) => {
  return res.status(404).json({
    status: "error",
    message: `${req.originalUrl} does not exist on the server. go to /api-docs to see available endpoint`
  })
});

app.use(errorHandler);

const PORT = process.env.PORT || 3000;
process.on('unhandledRejection', reason => {
  throw reason;
});

// sync() will create all table if they doesn't exist in database
models.sequelize.sync().then(() => {
  app.listen(PORT, (err) => {
    if (err) {
      return logger.error(err.message);
    }
    return logger.appStarted(process.env.PORT || 3000, 'localhost');
  });
})
/* eslint-disable @typescript-eslint/no-var-requires */
require('dotenv').config();
const { expect } = require('chai');
const supertest = require('supertest');

global.expect = expect;
global.supertest = supertest;
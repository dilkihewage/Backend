import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import mongoose from 'mongoose';
import app, { createApp } from '../src/app.js';
import { env } from '../src/config/env.js';
import { connectDatabase } from '../src/config/database.js';
import { PreAssessment } from '../src/models/PreAssessment.js';
import { UserProgress } from '../src/models/UserProgress.js';
import { DyslexiaSession } from '../src/models/DyslexiaSession.js';
import { GameAttempt } from '../src/models/GameAttempt.js';

env.mongodbUri = '';
const origin = 'https://r26-it-114-jflg.vercel.app';
const mockConnected = (t) => {
  const descriptor = Object.getOwnPropertyDescriptor(mongoose.connection, 'readyState');
  Object.defineProperty(mongoose.connection, 'readyState', { configurable: true, value: 1 });
  t.after(() => {
    if (descriptor) Object.defineProperty(mongoose.connection, 'readyState', descriptor);
    else delete mongoose.connection.readyState;
  });
};

test('default export is the single app used by Vercel', async () => {
  assert.equal((await request(app).get('/')).body.service, 'dyslexia-backend');
});

test('Vercel server entrypoint exports the same app without listening', async (t) => {
  const previous = process.env.VERCEL;
  process.env.VERCEL = '1';
  t.after(() => {
    if (previous === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = previous;
  });
  t.mock.method(app, 'listen', () => { throw new Error('Unexpected serverless listener'); });
  assert.equal((await import('../src/server.js')).default, app);
});

test('allowed origins, credentials and preflight headers', async () => {
  env.clientOrigins.push('https://second.example');
  for (const allowed of [origin, 'https://second.example', 'http://localhost:5173', 'http://127.0.0.1:3000']) {
    const response = await request(createApp()).options('/dashboard/child')
      .set('Origin', allowed).set('Access-Control-Request-Method', 'GET')
      .set('Access-Control-Request-Headers', 'authorization,content-type,x-user-id');
    assert.equal(response.status, 204);
    assert.equal(response.headers['access-control-allow-origin'], allowed);
    assert.equal(response.headers['access-control-allow-credentials'], 'true');
    assert.match(response.headers['access-control-allow-headers'], /Authorization/);
    assert.match(response.headers['access-control-allow-headers'], /Content-Type/);
    assert.match(response.headers.vary, /Origin/);
  }
});

test('unapproved origins are rejected including preflight', async () => {
  for (const method of ['get', 'options']) {
    const response = await request(app)[method]('/health').set('Origin', 'https://unapproved.example');
    assert.equal(response.status, 403);
    assert.equal(response.headers['access-control-allow-origin'], undefined);
  }
});

test('CORS survives application errors and database outages', async () => {
  for (const path of ['/dashboard/child', '/api/dyslexia/dashboard/child', '/health/db']) {
    const response = await request(app).get(path).set('Origin', origin);
    assert.equal(response.status, 503);
    assert.equal(response.headers['access-control-allow-origin'], origin);
    assert.equal(response.body.message, 'Database unavailable');
  }
  const malformed = await request(app).post('/api/dyslexia/assessment')
    .set('Origin', origin).set('Content-Type', 'application/json').send('{');
  assert.equal(malformed.status, 400);
  assert.equal(malformed.headers['access-control-allow-origin'], origin);
});

test('dashboard rejects placeholder and blank user IDs before database access', async () => {
  for (const id of [':userId', '%20', '%00']) {
    assert.equal((await request(app).get(`/dashboard/${id}`)).status, 400);
  }
});

test('concurrent database calls share a promise, reuse connection, and retry after failure', async (t) => {
  env.mongodbUri = 'mongodb://test.invalid/test';
  env.mongodbDbName = 'configured-db';
  t.after(() => { env.mongodbUri = ''; });
  let attempts = 0;
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  t.mock.method(mongoose, 'connect', async (uri, options) => {
    attempts += 1;
    assert.equal(options.dbName, 'configured-db');
    assert.equal(options.serverSelectionTimeoutMS, 5000);
    await gate;
    throw new Error('secret connection string');
  });
  const first = connectDatabase();
  const second = connectDatabase();
  release();
  const results = await Promise.allSettled([first, second]);
  assert.equal(attempts, 1);
  for (const result of results) {
    assert.equal(result.status, 'rejected');
    assert.equal(result.reason.statusCode, 503);
    assert.equal(result.reason.message, 'Database unavailable');
  }
  await assert.rejects(connectDatabase(), { statusCode: 503 });
  assert.equal(attempts, 2);
  mockConnected(t);
  assert.equal(await connectDatabase(), mongoose.connection);
  assert.equal(attempts, 2);
});

test('dashboard preserves empty and populated response shapes on both paths', async (t) => {
  mockConnected(t);
  let sessions = [];
  t.mock.method(PreAssessment, 'findOne', () => ({ lean: async () => null }));
  t.mock.method(UserProgress, 'findOne', () => ({ lean: async () => null }));
  t.mock.method(DyslexiaSession, 'find', (filter) => {
    assert.deepEqual(filter, { userId: 'firebase-uid', moduleId: 'dyslexia' });
    return { sort: () => ({ limit: () => ({ lean: async () => sessions }) }) };
  });
  for (const prefix of ['', '/api/dyslexia']) {
    const response = await request(app).get(`${prefix}/dashboard/firebase-uid`);
    assert.equal(response.status, 200);
    assert.equal(response.body.data.assessment, null);
    assert.equal(response.body.data.overall.totalSessions, 0);
    assert.deepEqual(response.body.data.games, []);
    assert.deepEqual(response.body.data.recentSessions, []);
  }
  sessions = [{ _id: 'session', gameKey: 'word-builder', sectionId: 6, status: 'completed',
    score: 8, totalQuestions: 10, correctAnswers: 8, startedAt: new Date(), completedAt: new Date() }];
  const legacy = await request(app).get('/dashboard/firebase-uid');
  const canonical = await request(app).get('/api/dyslexia/dashboard/firebase-uid');
  assert.deepEqual(legacy.body, canonical.body);
  assert.equal(legacy.body.data.games[0].accuracy, 80);
  assert.equal(legacy.body.data.overall.completedSessions, 1);
});

test('database health reports connected counts and catches query failures', async (t) => {
  mockConnected(t);
  for (const model of [PreAssessment, UserProgress, DyslexiaSession, GameAttempt]) {
    t.mock.method(model, 'countDocuments', async () => 2);
  }
  const healthy = await request(app).get('/health/db');
  assert.equal(healthy.status, 200);
  assert.equal(healthy.body.database.state, 'connected');
  assert.equal(healthy.body.database.counts.sessions, 2);
  t.mock.method(GameAttempt, 'countDocuments', async () => { throw new Error('sensitive internal failure'); });
  const failed = await request(app).get('/health/db').set('Origin', origin);
  assert.equal(failed.status, 503);
  assert.equal(failed.body.message, 'Database unavailable');
  assert.equal(failed.headers['access-control-allow-origin'], origin);
});

test('dashboard query errors do not expose sensitive values', async (t) => {
  mockConnected(t);
  t.mock.method(PreAssessment, 'findOne', () => { throw new Error('sensitive internal failure'); });
  const response = await request(app).get('/dashboard/child').set('Origin', origin);
  assert.equal(response.status, 500);
  assert.deepEqual(response.body, { success: false, message: 'Internal server error' });
  assert.equal(response.headers['access-control-allow-origin'], origin);
});

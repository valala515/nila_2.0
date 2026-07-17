import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildGreeting } from '../../src/application/useCases/greetNewUser.js';
import { createEmptyProfile } from '../../src/domain/interviewProfile.js';
import { startInterviewSession } from '../../src/domain/interviewSession.js';

test('buildGreeting for a brand-new user greets by name and formats with HTML bold + a mic-emoji hint', () => {
  const session = startInterviewSession('user-1', false);
  const profile = createEmptyProfile('user-1', 'Alex');

  const greeting = buildGreeting(session, profile);

  assert.match(greeting, /^Hi Alex! I'm Nila/);
  assert.match(greeting, /<b>a few short, focused blocks<\/b>/);
  assert.match(greeting, /🎤 <i>Simply reply with a voice message — no need to type\.<\/i>/);
});

test('buildGreeting escapes HTML-special characters in a Telegram display name', () => {
  const session = startInterviewSession('user-1', false);
  const profile = createEmptyProfile('user-1', '<Al&ex>');

  const greeting = buildGreeting(session, profile);

  assert.match(greeting, /^Hi &lt;Al&amp;ex&gt;! I'm Nila/);
});

test('buildGreeting for a returning user says welcome back with the escaped name and category progress', () => {
  const session = startInterviewSession('user-1', true);
  const profile = { ...createEmptyProfile('user-1', 'Al&ex'), currentPhase: 'intro' as const };

  const greeting = buildGreeting(session, profile);

  assert.match(greeting, /^Welcome back, Al&amp;ex! Let's pick up where we left off\./);
  assert.match(greeting, /Intro: /);
});

import type { InterviewSession } from '../../domain/interviewSession.js';

export function buildGreeting(session: InterviewSession): string {
  if (session.status === 'not_started') {
    return "Hi! I'm Nila — I'll help you figure out what's going on with your body and wellbeing. Ready to start a short interview?";
  }
  return "Welcome back! Let's pick up where we left off.";
}

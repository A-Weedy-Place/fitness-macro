import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { DailyGoal, UserProfile } from '../contracts.js';

export interface GoalAdvice {
  summary: string;
  actions: string[];
  cautions: string[];
}

const providerDir = path.dirname(fileURLToPath(import.meta.url));
const advisorDir = path.resolve(providerDir, '../../goal-agent');
const schemaFile = path.resolve(advisorDir, 'goal-output.schema.json');
let running = false;

export function codexGoalAdvisorStatus() {
  return { enabled: process.env.CODEX_GOAL_ADVISOR_ENABLED === 'true', busy: running };
}

export async function reviewGoalWithCodex(profile: UserProfile, goal: DailyGoal, tdee: number): Promise<GoalAdvice | null> {
  if (process.env.CODEX_GOAL_ADVISOR_ENABLED !== 'true') return null;
  if (running) throw new Error('codex_goal_advisor_busy');
  running = true;
  const outputFile = path.resolve(os.tmpdir(), `fitness-codex-goal-${randomBytes(12).toString('hex')}.json`);
  const timeoutMs = Math.max(10, Number(process.env.CODEX_FOOD_TIMEOUT_SECONDS || 90)) * 1000;
  const args = ['exec', '--sandbox', 'read-only', '--ask-for-approval', 'never', '--skip-git-repo-check', '--output-schema', schemaFile, '--output-last-message', outputFile];
  if (process.env.CODEX_FOOD_MODEL) args.push('--model', process.env.CODEX_FOOD_MODEL);
  args.push('-');
  const safeInput = { ageYears: profile.ageYears, sex: profile.sex, heightCm: profile.heightCm, bodyWeightKg: profile.bodyWeightKg, targetWeightKg: profile.targetWeightKg, targetDate: profile.targetDate, goalMode: profile.goalMode, goalIntensity: profile.goalIntensity, weeklyWeightChangeKg: profile.weeklyWeightChangeKg, activityFactor: profile.activityFactor, tdee, dailyGoal: goal };
  const prompt = ['Review this already-calculated fitness goal in plain language.', 'Do not change or invent calorie or macro numbers. Do not diagnose, prescribe, or claim guaranteed outcomes.', 'Give practical logging and adherence actions and clearly state uncertainty.', `Calculation JSON: ${JSON.stringify(safeInput)}`].join('\n');
  try {
    await new Promise<void>((resolve, reject) => {
      const child = spawn(process.env.CODEX_BIN || 'codex', args, { cwd: advisorDir, env: process.env, stdio: ['pipe', 'ignore', 'pipe'] });
      let stderr = ''; let timedOut = false;
      child.stderr.on('data', (chunk) => { stderr = `${stderr}${String(chunk)}`.slice(-4000); });
      child.on('error', (error) => reject(new Error(`codex_spawn_failed:${error.message}`)));
      const timer = setTimeout(() => { timedOut = true; child.kill('SIGTERM'); }, timeoutMs);
      child.on('close', (code) => { clearTimeout(timer); if (timedOut) reject(new Error('codex_goal_timeout')); else if (code !== 0) reject(new Error(`codex_goal_failed_${code}:${stderr}`)); else resolve(); });
      child.stdin.end(prompt);
    });
    return JSON.parse(fs.readFileSync(outputFile, 'utf8')) as GoalAdvice;
  } finally {
    running = false;
    if (fs.existsSync(outputFile)) fs.unlinkSync(outputFile);
  }
}

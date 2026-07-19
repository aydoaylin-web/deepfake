import fs from 'node:fs/promises';

const posts = JSON.parse(await fs.readFile('public/content/posts.json', 'utf8'));
const tasks = JSON.parse(await fs.readFile('public/content/tasks.json', 'utf8'));
const taskMap = new Map(tasks.map(task => [task.id, task]));
const errors = [];

const reviewPosts = posts.filter(post => post.reviewTaskId);
if (reviewPosts.length < 2) errors.push('At least two feed posts must offer voluntary review.');

for (const post of reviewPosts) {
  const task = taskMap.get(post.reviewTaskId);
  if (!task) {
    errors.push(`${post.id}: reviewTaskId ${post.reviewTaskId} does not exist.`);
    continue;
  }
  if (task.type !== 'news') errors.push(`${post.id}: voluntary feed review must reference a news task.`);
  if (task.postId !== post.id) errors.push(`${post.id}: review task ${task.id} references ${task.postId}.`);
  if (!['echt', 'manipuliert', 'suspekt'].includes(task.correctVerdict)) errors.push(`${task.id}: correctVerdict is missing or invalid.`);
}

const verdicts = new Set(reviewPosts.map(post => taskMap.get(post.reviewTaskId)?.correctVerdict));
if (!verdicts.has('echt') || !verdicts.has('manipuliert') || !verdicts.has('suspekt')) {
  errors.push('Feed reviews must contain echt, manipuliert and suspekt cases.');
}

const pushPosts = posts.filter(post => post.taskId);
if (!pushPosts.length) errors.push('At least one push-triggered task is required.');

if (errors.length) {
  console.error('Game-mechanics validation failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Game mechanics valid: ${reviewPosts.length} voluntary feed reviews, ${pushPosts.length} push-enabled posts, both verdict classes present.`);

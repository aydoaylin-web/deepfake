import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const publicDir = path.join(root, 'public');
const readJson = async file => JSON.parse(await fs.readFile(path.join(publicDir, file), 'utf8'));
const manifest = await readJson('content/manifest.json');
const entries = await Promise.all(Object.entries(manifest.files).map(async ([key, file]) => [key, await readJson(file)]));
const content = Object.fromEntries(entries);
const requiredArrays = ['profiles', 'stories', 'posts', 'tasks', 'guides'];
const errors = [];
for (const key of requiredArrays) if (!Array.isArray(content[key])) errors.push(`${key} must be an array.`);
const unique = (items, label) => {
  const ids = new Set();
  for (const item of items || []) {
    if (!item?.id) errors.push(`${label}: entry without id.`);
    else if (ids.has(item.id)) errors.push(`${label}: duplicate id ${item.id}.`);
    else ids.add(item.id);
  }
  return ids;
};
const profileIds = unique(content.profiles, 'profiles');
const postIds = unique(content.posts, 'posts');
const taskIds = unique(content.tasks, 'tasks');
unique(content.stories, 'stories');
unique(content.guides, 'guides');
for (const post of content.posts || []) {
  if (!post.username) errors.push(`post ${post.id}: username missing.`);
  if (!post.media) errors.push(`post ${post.id}: media missing.`);
  if (post.profileId && !profileIds.has(post.profileId)) errors.push(`post ${post.id}: missing profile ${post.profileId}.`);
  if (post.taskId && !taskIds.has(post.taskId)) errors.push(`post ${post.id}: missing task ${post.taskId}.`);
  if (post.reviewTaskId && !taskIds.has(post.reviewTaskId)) errors.push(`post ${post.id}: missing review task ${post.reviewTaskId}.`);
  if (post.media) {
    try { await fs.access(path.join(publicDir, post.media)); }
    catch { errors.push(`post ${post.id}: media file not found (${post.media}).`); }
  }
}
for (const task of content.tasks || []) {
  if (!postIds.has(task.postId)) errors.push(`task ${task.id}: missing post ${task.postId}.`);
  if (task.followUpTaskId && !taskIds.has(task.followUpTaskId)) errors.push(`task ${task.id}: missing follow-up ${task.followUpTaskId}.`);
  if (!Number.isFinite(Number(task.pointsCorrect))) errors.push(`task ${task.id}: pointsCorrect must be numeric.`);
  if (!Number.isFinite(Number(task.pointsWrong))) errors.push(`task ${task.id}: pointsWrong must be numeric.`);
  if (task.type === 'news' && !['echt', 'manipuliert', 'suspekt'].includes(task.correctVerdict)) errors.push(`task ${task.id}: news task needs correctVerdict echt, manipuliert or suspekt.`);
}
for (const guide of content.guides || []) {
  if (guide.image) {
    try { await fs.access(path.join(publicDir, guide.image)); }
    catch { errors.push(`guide ${guide.id}: image file not found (${guide.image}).`); }
  }
}
if (errors.length) {
  console.error(`Content validation failed with ${errors.length} error(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log(`Content pack valid: ${content.posts.length} posts, ${content.tasks.length} tasks, ${content.profiles.length} profiles, ${content.stories.length} stories, ${content.guides.length} guides.`);

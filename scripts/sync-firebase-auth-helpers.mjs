import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const outputDir = path.resolve(process.argv[2] ?? 'dist');
const sourceOrigin = 'https://recall-memory-20260326.firebaseapp.com';
const authDomain = 'learnwise.online';
const helperFiles = [
  '__/auth/handler',
  '__/auth/handler.js',
  '__/auth/experiments.js',
  '__/auth/iframe',
  '__/auth/iframe.js',
  '__/auth/links',
  '__/auth/links.js',
];

const initConfig = {
  apiKey: 'AIzaSyBBhmqhwgAhvzmgXobBPcIbLaIquj5TlwY',
  authDomain,
  projectId: 'recall-memory-20260326',
  storageBucket: 'recall-memory-20260326.firebasestorage.app',
  messagingSenderId: '1038616079340',
  appId: '1:1038616079340:web:30f3c5a0e6b9f595d96ec9',
};

for (const relativeFile of helperFiles) {
  const response = await fetch(`${sourceOrigin}/${relativeFile}`);
  if (!response.ok) {
    throw new Error(`Unable to download ${relativeFile}: ${response.status}`);
  }

  const destination = path.join(outputDir, relativeFile);
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, Buffer.from(await response.arrayBuffer()));
}

const initJsonPath = path.join(outputDir, '__/firebase/init.json');
await mkdir(path.dirname(initJsonPath), { recursive: true });
await writeFile(initJsonPath, `${JSON.stringify(initConfig, null, 2)}\n`);

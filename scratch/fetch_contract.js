import admin from 'firebase-admin';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(readFileSync('./lawlanes-9l5z-firebase-adminsdk-xxxxx.json', 'utf8')); // Wait, I don't have the service account key path.

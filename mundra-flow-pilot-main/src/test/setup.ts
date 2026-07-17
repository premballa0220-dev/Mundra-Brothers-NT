import '@testing-library/jest-dom';
import { loadEnv } from 'vite';

const env = loadEnv('', process.cwd(), '');
process.env = { ...process.env, ...env };

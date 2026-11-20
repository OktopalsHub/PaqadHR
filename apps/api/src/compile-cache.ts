import { enableCompileCache } from 'node:module';

// Caches compiled JS on disk so repeat boots skip recompiling every file (Node 22.1+).
enableCompileCache?.();

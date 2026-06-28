import path from 'node:path';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
/** Config solo para tests: no modifica el build de producción (`vite build` usa vite.config.ts). */
export default defineConfig({
    plugins: [react()],
    test: {
        environment: 'jsdom',
        include: ['src/**/*.{test,spec}.{ts,tsx}'],
        passWithNoTests: true,
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
});

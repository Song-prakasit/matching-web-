import { config } from '../config.js';

export const repo = config.dbMode === 'mock' ? await import('./mockRepo.js') : await import('./mssqlRepo.js');

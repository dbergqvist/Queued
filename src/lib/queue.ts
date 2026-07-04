import type { Tables } from '$lib/database.types';

export type QueueItem = Tables<'queue_items'>;
export type MediaType = 'book' | 'movie' | 'tv' | 'music';
export type QueueStatus = 'queued' | 'in_progress' | 'finished' | 'abandoned';
export type QueuePriority = 'low' | 'normal' | 'high';

export const mediaTypes: Array<{ value: MediaType; label: string }> = [
	{ value: 'book', label: 'Book' },
	{ value: 'movie', label: 'Movie' },
	{ value: 'tv', label: 'TV' },
	{ value: 'music', label: 'Music' }
];

export const queueStatuses: Array<{ value: QueueStatus; label: string }> = [
	{ value: 'queued', label: 'Queued' },
	{ value: 'in_progress', label: 'In progress' },
	{ value: 'finished', label: 'Finished' },
	{ value: 'abandoned', label: 'Abandoned' }
];

export const queuePriorities: Array<{ value: QueuePriority; label: string }> = [
	{ value: 'low', label: 'Low' },
	{ value: 'normal', label: 'Normal' },
	{ value: 'high', label: 'High' }
];

import { describe, expect, it } from 'vitest';

import { mediaTypes, queuePriorities, queueStatuses } from './queue';

describe('queue options', () => {
	it('contains the supported media types and default workflow values', () => {
		expect.assertions(3);

		expect(mediaTypes.map((type) => type.value)).toEqual(['book', 'movie', 'tv', 'music']);
		expect(queueStatuses.map((status) => status.value)).toEqual([
			'queued',
			'in_progress',
			'finished',
			'abandoned'
		]);
		expect(queuePriorities.map((priority) => priority.value)).toEqual(['low', 'normal', 'high']);
	});
});

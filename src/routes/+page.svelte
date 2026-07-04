<script lang="ts">
	import { onMount } from 'svelte';
	import type { Provider, Session } from '@supabase/supabase-js';

	import {
		mediaTypes,
		queuePriorities,
		queueStatuses,
		type MediaType,
		type QueueItem,
		type QueuePriority,
		type QueueStatus
	} from '$lib/queue';
	import { supabase } from '$lib/supabase/client';

	let session = $state<Session | null>(null);
	let items = $state<QueueItem[]>([]);
	let loading = $state(true);
	let saving = $state(false);
	let authLoading = $state(false);
	let message = $state('');
	let error = $state('');

	let showAuthOptions = $state(false);
	let email = $state('');
	let password = $state('');
	let authMode = $state<'sign_in' | 'sign_up'>('sign_in');
	let title = $state('');
	let mediaType = $state<MediaType>('book');
	let status = $state<QueueStatus>('queued');
	let priority = $state<QueuePriority>('normal');
	let source = $state('');
	let sourceUrl = $state('');
	let notes = $state('');
	let tags = $state('');
	let search = $state('');
	let typeFilter = $state<'all' | MediaType>('all');
	let statusFilter = $state<'all' | QueueStatus>('all');
	let priorityFilter = $state<'all' | QueuePriority>('all');
	let tagFilter = $state('all');
	let editingItemId = $state<string | null>(null);
	let editTitle = $state('');
	let editMediaType = $state<MediaType>('book');
	let editStatus = $state<QueueStatus>('queued');
	let editPriority = $state<QueuePriority>('normal');
	let editSource = $state('');
	let editSourceUrl = $state('');
	let editNotes = $state('');
	let editTags = $state('');
	let pendingDeleteItemId = $state<string | null>(null);

	let signedInEmail = $derived(session?.user.email ?? '');
	let allTags = $derived.by(() =>
		Array.from(new Set(items.flatMap((item) => item.tags))).sort((left, right) =>
			left.localeCompare(right)
		)
	);
	let queueStats = $derived.by(() => ({
		queued: items.filter((item) => item.status === 'queued').length,
		inProgress: items.filter((item) => item.status === 'in_progress').length,
		finished: items.filter((item) => item.status === 'finished').length,
		abandoned: items.filter((item) => item.status === 'abandoned').length
	}));

	let filteredItems = $derived.by(() => {
		const query = search.trim().toLowerCase();

		return items.filter((item) => {
			const matchesType = typeFilter === 'all' || item.media_type === typeFilter;
			const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
			const matchesPriority = priorityFilter === 'all' || item.priority === priorityFilter;
			const matchesTag = tagFilter === 'all' || item.tags.includes(tagFilter);
			const matchesSearch =
				!query ||
				[item.title, item.source, item.notes, item.tags.join(' ')]
					.filter(Boolean)
					.some((value) => value?.toLowerCase().includes(query));

			return matchesType && matchesStatus && matchesPriority && matchesTag && matchesSearch;
		});
	});

	function parseTags(value: string) {
		return Array.from(
			new Set(
				value
					.split(',')
					.map((tag) => tag.trim().toLowerCase())
					.filter(Boolean)
			)
		);
	}

	function getErrorMessage(value: unknown) {
		return value instanceof Error ? value.message : 'Something went wrong.';
	}

	function withTimeout<T>(promise: Promise<T>, milliseconds: number, timeoutMessage: string) {
		return Promise.race<T>([
			promise,
			new Promise<T>((_, reject) => {
				window.setTimeout(() => reject(new Error(timeoutMessage)), milliseconds);
			})
		]);
	}

	onMount(() => {
		let mounted = true;

		async function init() {
			try {
				const { data, error: sessionError } = await withTimeout(
					supabase.auth.getSession(),
					7000,
					'Supabase auth did not respond. Check your network connection and Supabase project settings.'
				);

				if (!mounted) return;

				if (sessionError) {
					error = sessionError.message;
				}

				session = data.session;

				if (data.session) {
					await loadItems();
				}
			} catch (initError) {
				if (mounted) {
					error = getErrorMessage(initError);
				}
			} finally {
				if (mounted) {
					loading = false;
				}
			}
		}

		const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
			session = nextSession;
			message = '';
			error = '';

			if (nextSession) {
				void loadItems();
			} else {
				items = [];
			}
		});

		void init();

		return () => {
			mounted = false;
			data.subscription.unsubscribe();
		};
	});

	async function loadItems() {
		const { data, error: loadError } = await supabase
			.from('queue_items')
			.select('*')
			.order('created_at', { ascending: false });

		if (loadError) {
			error = loadError.message;
			return;
		}

		items = data;
	}

	async function sendMagicLink() {
		authLoading = true;
		error = '';
		message = '';

		const { error: signInError } = await supabase.auth.signInWithOtp({
			email,
			options: {
				emailRedirectTo: window.location.origin
			}
		});

		authLoading = false;

		if (signInError) {
			error = signInError.message;
			return;
		}

		message = 'Check your email for the sign-in link.';
	}

	async function submitPasswordAuth() {
		authLoading = true;
		error = '';
		message = '';

		const credentials = {
			email,
			password
		};

		const { data, error: authError } =
			authMode === 'sign_in'
				? await supabase.auth.signInWithPassword(credentials)
				: await supabase.auth.signUp({
						...credentials,
						options: {
							emailRedirectTo: window.location.origin
						}
					});

		authLoading = false;

		if (authError) {
			error = authError.message;
			return;
		}

		if (authMode === 'sign_up' && !data.session) {
			message = 'Account created. Check your email to confirm your address before signing in.';
			return;
		}

		password = '';
	}

	async function signInWithProvider(provider: Provider) {
		authLoading = true;
		error = '';
		message = '';

		const { error: providerError } = await supabase.auth.signInWithOAuth({
			provider,
			options: {
				redirectTo: window.location.origin
			}
		});

		authLoading = false;

		if (providerError) {
			error = providerError.message;
		}
	}

	async function signOut() {
		await supabase.auth.signOut();
	}

	async function addItem() {
		if (!session || !title.trim()) return;

		saving = true;
		error = '';

		const { error: insertError } = await supabase.from('queue_items').insert({
			user_id: session.user.id,
			title: title.trim(),
			media_type: mediaType,
			status,
			priority,
			source: source.trim() || null,
			source_url: sourceUrl.trim() || null,
			notes: notes.trim() || null,
			tags: parseTags(tags)
		});

		saving = false;

		if (insertError) {
			error = insertError.message;
			return;
		}

		title = '';
		mediaType = 'book';
		status = 'queued';
		priority = 'normal';
		source = '';
		sourceUrl = '';
		notes = '';
		tags = '';
		await loadItems();
	}

	function startEditing(item: QueueItem) {
		editingItemId = item.id;
		pendingDeleteItemId = null;
		editTitle = item.title;
		editMediaType = item.media_type as MediaType;
		editStatus = item.status as QueueStatus;
		editPriority = item.priority as QueuePriority;
		editSource = item.source ?? '';
		editSourceUrl = item.source_url ?? '';
		editNotes = item.notes ?? '';
		editTags = item.tags.join(', ');
	}

	function cancelEditing() {
		editingItemId = null;
		editTitle = '';
		editSource = '';
		editSourceUrl = '';
		editNotes = '';
		editTags = '';
	}

	async function saveEdit(item: QueueItem) {
		if (!editTitle.trim()) return;

		saving = true;
		error = '';

		const { data, error: updateError } = await supabase
			.from('queue_items')
			.update({
				title: editTitle.trim(),
				media_type: editMediaType,
				status: editStatus,
				priority: editPriority,
				source: editSource.trim() || null,
				source_url: editSourceUrl.trim() || null,
				notes: editNotes.trim() || null,
				tags: parseTags(editTags)
			})
			.eq('id', item.id)
			.select()
			.single();

		saving = false;

		if (updateError) {
			error = updateError.message;
			return;
		}

		items = items.map((current) => (current.id === item.id ? data : current));
		cancelEditing();
	}

	async function updateStatus(item: QueueItem, nextStatus: QueueStatus) {
		error = '';

		const { error: updateError } = await supabase
			.from('queue_items')
			.update({ status: nextStatus })
			.eq('id', item.id);

		if (updateError) {
			error = updateError.message;
			return;
		}

		items = items.map((current) =>
			current.id === item.id ? { ...current, status: nextStatus } : current
		);
	}

	async function deleteItem(item: QueueItem) {
		error = '';
		pendingDeleteItemId = null;

		const { error: deleteError } = await supabase.from('queue_items').delete().eq('id', item.id);

		if (deleteError) {
			error = deleteError.message;
			return;
		}

		items = items.filter((current) => current.id !== item.id);
	}
</script>

<svelte:head>
	<title>Queued</title>
	<meta
		name="description"
		content="A personal queue for books, movies, TV series, and music."
	/>
</svelte:head>

<main class="min-h-screen">
	<header class="border-b border-stone-200 bg-white">
		<div class="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
			<div>
				<p class="text-xs font-semibold uppercase tracking-wide text-teal-700">Queued</p>
				<h1 class="text-xl font-semibold text-stone-950">Your media queue</h1>
			</div>

			{#if session}
				<div class="flex items-center gap-3">
					{#if signedInEmail}
						<p class="hidden max-w-52 truncate text-sm text-stone-600 sm:block">{signedInEmail}</p>
					{/if}
					<button
						type="button"
						class="rounded-md border border-stone-300 px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
						onclick={signOut}
					>
						Sign out
					</button>
				</div>
			{/if}
		</div>
	</header>

	<div class="mx-auto grid max-w-6xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[360px_1fr]">
		{#if loading}
			<p class="text-sm text-stone-600">Loading...</p>
		{:else if !session}
			<section class="max-w-md rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
				<button
					type="button"
					disabled={authLoading}
					class="w-full rounded-md bg-stone-950 px-4 py-2 text-sm font-semibold text-white hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-60"
					onclick={() => signInWithProvider('github')}
				>
					Continue with GitHub
				</button>

				<button
					type="button"
					class="mt-3 w-full rounded-md border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
					onclick={() => (showAuthOptions = !showAuthOptions)}
				>
					{showAuthOptions ? 'Hide sign-in options' : 'More sign-in options'}
				</button>

				{#if showAuthOptions}
					<div class="my-4 flex items-center gap-3">
						<div class="h-px flex-1 bg-stone-200"></div>
						<p class="text-xs font-medium uppercase tracking-wide text-stone-500">or</p>
						<div class="h-px flex-1 bg-stone-200"></div>
					</div>

					<button
						type="button"
						disabled={authLoading}
						class="w-full rounded-md border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-60"
						onclick={() => signInWithProvider('google')}
					>
						Continue with Google
					</button>

					<div class="mt-4 flex rounded-md border border-stone-300 bg-stone-50 p-1">
						<button
							type="button"
							class={`flex-1 rounded px-3 py-2 text-sm font-medium ${
								authMode === 'sign_in'
									? 'bg-white text-stone-950 shadow-sm'
									: 'text-stone-600 hover:text-stone-950'
							}`}
							onclick={() => (authMode = 'sign_in')}
						>
							Sign in
						</button>
						<button
							type="button"
							class={`flex-1 rounded px-3 py-2 text-sm font-medium ${
								authMode === 'sign_up'
									? 'bg-white text-stone-950 shadow-sm'
									: 'text-stone-600 hover:text-stone-950'
							}`}
							onclick={() => (authMode = 'sign_up')}
						>
							Create account
						</button>
					</div>

					<form
						class="mt-4 space-y-4"
						onsubmit={(event) => (event.preventDefault(), submitPasswordAuth())}
					>
						<label class="block">
							<span class="text-sm font-medium text-stone-700">Email</span>
							<input
								type="email"
								required
								bind:value={email}
								class="mt-1 block w-full rounded-md border-stone-300 shadow-sm focus:border-teal-600 focus:ring-teal-600"
								placeholder="you@example.com"
							/>
						</label>

						<label class="block">
							<span class="text-sm font-medium text-stone-700">Password</span>
							<input
								type="password"
								required
								minlength="6"
								bind:value={password}
								class="mt-1 block w-full rounded-md border-stone-300 shadow-sm focus:border-teal-600 focus:ring-teal-600"
								placeholder="At least 6 characters"
							/>
						</label>

						<button
							type="submit"
							disabled={authLoading}
							class="w-full rounded-md bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
						>
							{authLoading ? 'Working...' : authMode === 'sign_in' ? 'Sign in' : 'Create account'}
						</button>
					</form>

					<div class="mt-4 border-t border-stone-200 pt-4">
						<button
							type="button"
							disabled={authLoading || !email}
							class="w-full rounded-md border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-60"
							onclick={sendMagicLink}
						>
							Send magic link instead
						</button>
					</div>
				{/if}
			</section>
		{:else}
			<section class="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
				<h2 class="text-lg font-semibold text-stone-950">Add item</h2>

				<form class="mt-4 space-y-4" onsubmit={(event) => (event.preventDefault(), addItem())}>
					<label class="block">
						<span class="text-sm font-medium text-stone-700">Title</span>
						<input
							type="text"
							required
							bind:value={title}
							class="mt-1 block w-full rounded-md border-stone-300 shadow-sm focus:border-teal-600 focus:ring-teal-600"
							placeholder="The Left Hand of Darkness"
						/>
					</label>

					<div class="grid grid-cols-2 gap-3">
						<label class="block">
							<span class="text-sm font-medium text-stone-700">Type</span>
							<select
								bind:value={mediaType}
								class="mt-1 block w-full rounded-md border-stone-300 shadow-sm focus:border-teal-600 focus:ring-teal-600"
							>
								{#each mediaTypes as option}
									<option value={option.value}>{option.label}</option>
								{/each}
							</select>
						</label>

						<label class="block">
							<span class="text-sm font-medium text-stone-700">Priority</span>
							<select
								bind:value={priority}
								class="mt-1 block w-full rounded-md border-stone-300 shadow-sm focus:border-teal-600 focus:ring-teal-600"
							>
								{#each queuePriorities as option}
									<option value={option.value}>{option.label}</option>
								{/each}
							</select>
						</label>
					</div>

					<label class="block">
						<span class="text-sm font-medium text-stone-700">Status</span>
						<select
							bind:value={status}
							class="mt-1 block w-full rounded-md border-stone-300 shadow-sm focus:border-teal-600 focus:ring-teal-600"
						>
							{#each queueStatuses as option}
								<option value={option.value}>{option.label}</option>
							{/each}
						</select>
					</label>

					<label class="block">
						<span class="text-sm font-medium text-stone-700">Source</span>
						<input
							type="text"
							bind:value={source}
							class="mt-1 block w-full rounded-md border-stone-300 shadow-sm focus:border-teal-600 focus:ring-teal-600"
							placeholder="Friend, review, podcast, bookstore..."
						/>
					</label>

					<label class="block">
						<span class="text-sm font-medium text-stone-700">Source URL</span>
						<input
							type="url"
							bind:value={sourceUrl}
							class="mt-1 block w-full rounded-md border-stone-300 shadow-sm focus:border-teal-600 focus:ring-teal-600"
							placeholder="https://..."
						/>
					</label>

					<label class="block">
						<span class="text-sm font-medium text-stone-700">Tags</span>
						<input
							type="text"
							bind:value={tags}
							class="mt-1 block w-full rounded-md border-stone-300 shadow-sm focus:border-teal-600 focus:ring-teal-600"
							placeholder="sci-fi, weekend, with friends"
						/>
					</label>

					<label class="block">
						<span class="text-sm font-medium text-stone-700">Notes</span>
						<textarea
							bind:value={notes}
							rows="3"
							class="mt-1 block w-full rounded-md border-stone-300 shadow-sm focus:border-teal-600 focus:ring-teal-600"
						></textarea>
					</label>

					<button
						type="submit"
						disabled={saving}
						class="w-full rounded-md bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
					>
						{saving ? 'Saving...' : 'Add to queue'}
					</button>
				</form>
			</section>

			<section>
				<div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
					<div>
						<h2 class="text-lg font-semibold text-stone-950">Queue</h2>
						<p class="text-sm text-stone-600">
							{filteredItems.length} of {items.length} saved items
						</p>
					</div>
				</div>

				<div class="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
					<div class="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
						<p class="text-xs font-medium uppercase tracking-wide text-stone-500">Queued</p>
						<p class="mt-1 text-2xl font-semibold text-stone-950">{queueStats.queued}</p>
					</div>
					<div class="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
						<p class="text-xs font-medium uppercase tracking-wide text-stone-500">In progress</p>
						<p class="mt-1 text-2xl font-semibold text-stone-950">{queueStats.inProgress}</p>
					</div>
					<div class="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
						<p class="text-xs font-medium uppercase tracking-wide text-stone-500">Finished</p>
						<p class="mt-1 text-2xl font-semibold text-stone-950">{queueStats.finished}</p>
					</div>
					<div class="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
						<p class="text-xs font-medium uppercase tracking-wide text-stone-500">Abandoned</p>
						<p class="mt-1 text-2xl font-semibold text-stone-950">{queueStats.abandoned}</p>
					</div>
				</div>

				<div class="mt-4 grid gap-3 rounded-lg border border-stone-200 bg-white p-4 shadow-sm sm:grid-cols-2 xl:grid-cols-5">
					<label class="block sm:col-span-2 xl:col-span-1">
						<span class="text-sm font-medium text-stone-700">Search</span>
						<input
							type="search"
							bind:value={search}
							class="mt-1 block w-full rounded-md border-stone-300 shadow-sm focus:border-teal-600 focus:ring-teal-600"
							placeholder="Title, source, notes"
						/>
					</label>

					<label class="block">
						<span class="text-sm font-medium text-stone-700">Type</span>
						<select
							bind:value={typeFilter}
							class="mt-1 block w-full rounded-md border-stone-300 bg-white shadow-sm focus:border-teal-600 focus:ring-teal-600"
						>
							<option value="all">All</option>
							{#each mediaTypes as option}
								<option value={option.value}>{option.label}</option>
							{/each}
						</select>
					</label>

					<label class="block">
						<span class="text-sm font-medium text-stone-700">Status</span>
						<select
							bind:value={statusFilter}
							class="mt-1 block w-full rounded-md border-stone-300 bg-white shadow-sm focus:border-teal-600 focus:ring-teal-600"
						>
							<option value="all">All</option>
							{#each queueStatuses as option}
								<option value={option.value}>{option.label}</option>
							{/each}
						</select>
					</label>

					<label class="block">
						<span class="text-sm font-medium text-stone-700">Priority</span>
						<select
							bind:value={priorityFilter}
							class="mt-1 block w-full rounded-md border-stone-300 bg-white shadow-sm focus:border-teal-600 focus:ring-teal-600"
						>
							<option value="all">All</option>
							{#each queuePriorities as option}
								<option value={option.value}>{option.label}</option>
							{/each}
						</select>
					</label>

					<label class="block">
						<span class="text-sm font-medium text-stone-700">Tag</span>
						<select
							bind:value={tagFilter}
							class="mt-1 block w-full rounded-md border-stone-300 bg-white shadow-sm focus:border-teal-600 focus:ring-teal-600"
						>
							<option value="all">All</option>
							{#each allTags as tag}
								<option value={tag}>{tag}</option>
							{/each}
						</select>
					</label>
				</div>

				{#if filteredItems.length === 0}
					<div class="mt-4 rounded-lg border border-dashed border-stone-300 bg-white p-8 text-center text-sm text-stone-600">
						Nothing queued yet.
					</div>
				{:else}
					<div class="mt-4 grid gap-3">
						{#each filteredItems as item (item.id)}
							<article class="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
								{#if editingItemId === item.id}
									<form class="space-y-4" onsubmit={(event) => (event.preventDefault(), saveEdit(item))}>
										<label class="block">
											<span class="text-sm font-medium text-stone-700">Title</span>
											<input
												type="text"
												required
												bind:value={editTitle}
												class="mt-1 block w-full rounded-md border-stone-300 shadow-sm focus:border-teal-600 focus:ring-teal-600"
											/>
										</label>

										<div class="grid gap-3 sm:grid-cols-3">
											<label class="block">
												<span class="text-sm font-medium text-stone-700">Type</span>
												<select
													bind:value={editMediaType}
													class="mt-1 block w-full rounded-md border-stone-300 shadow-sm focus:border-teal-600 focus:ring-teal-600"
												>
													{#each mediaTypes as option}
														<option value={option.value}>{option.label}</option>
													{/each}
												</select>
											</label>

											<label class="block">
												<span class="text-sm font-medium text-stone-700">Status</span>
												<select
													bind:value={editStatus}
													class="mt-1 block w-full rounded-md border-stone-300 shadow-sm focus:border-teal-600 focus:ring-teal-600"
												>
													{#each queueStatuses as option}
														<option value={option.value}>{option.label}</option>
													{/each}
												</select>
											</label>

											<label class="block">
												<span class="text-sm font-medium text-stone-700">Priority</span>
												<select
													bind:value={editPriority}
													class="mt-1 block w-full rounded-md border-stone-300 shadow-sm focus:border-teal-600 focus:ring-teal-600"
												>
													{#each queuePriorities as option}
														<option value={option.value}>{option.label}</option>
													{/each}
												</select>
											</label>
										</div>

										<div class="grid gap-3 sm:grid-cols-2">
											<label class="block">
												<span class="text-sm font-medium text-stone-700">Source</span>
												<input
													type="text"
													bind:value={editSource}
													class="mt-1 block w-full rounded-md border-stone-300 shadow-sm focus:border-teal-600 focus:ring-teal-600"
												/>
											</label>

											<label class="block">
												<span class="text-sm font-medium text-stone-700">Source URL</span>
												<input
													type="url"
													bind:value={editSourceUrl}
													class="mt-1 block w-full rounded-md border-stone-300 shadow-sm focus:border-teal-600 focus:ring-teal-600"
												/>
											</label>
										</div>

										<label class="block">
											<span class="text-sm font-medium text-stone-700">Tags</span>
											<input
												type="text"
												bind:value={editTags}
												class="mt-1 block w-full rounded-md border-stone-300 shadow-sm focus:border-teal-600 focus:ring-teal-600"
												placeholder="sci-fi, weekend, with friends"
											/>
										</label>

										<label class="block">
											<span class="text-sm font-medium text-stone-700">Notes</span>
											<textarea
												bind:value={editNotes}
												rows="3"
												class="mt-1 block w-full rounded-md border-stone-300 shadow-sm focus:border-teal-600 focus:ring-teal-600"
											></textarea>
										</label>

										<div class="flex justify-end gap-2">
											<button
												type="button"
												class="rounded-md border border-stone-300 px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
												onclick={cancelEditing}
											>
												Cancel
											</button>
											<button
												type="submit"
												disabled={saving}
												class="rounded-md bg-teal-700 px-3 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
											>
												{saving ? 'Saving...' : 'Save changes'}
											</button>
										</div>
									</form>
								{:else}
									<div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
										<div class="min-w-0">
											<div class="flex flex-wrap items-center gap-2">
												<h3 class="text-base font-semibold text-stone-950">{item.title}</h3>
												<span class="rounded bg-stone-100 px-2 py-1 text-xs font-medium capitalize text-stone-700">
													{item.media_type}
												</span>
												<span class="rounded bg-amber-100 px-2 py-1 text-xs font-medium capitalize text-amber-900">
													{item.priority}
												</span>
											</div>

											{#if item.source}
												<p class="mt-2 text-sm text-stone-600">Source: {item.source}</p>
											{/if}

											{#if item.source_url}
												<a
													class="mt-1 inline-block break-all text-sm font-medium text-teal-700 hover:text-teal-900"
													href={item.source_url}
													target="_blank"
													rel="noreferrer"
												>
													{item.source_url}
												</a>
											{/if}

											{#if item.tags.length > 0}
												<div class="mt-2 flex flex-wrap gap-2">
													{#each item.tags as tag}
														<button
															type="button"
															class="rounded bg-teal-50 px-2 py-1 text-xs font-medium text-teal-800 hover:bg-teal-100"
															onclick={() => (tagFilter = tag)}
														>
															{tag}
														</button>
													{/each}
												</div>
											{/if}

											{#if item.notes}
												<p class="mt-2 whitespace-pre-wrap text-sm text-stone-700">{item.notes}</p>
											{/if}
										</div>

										<div class="flex shrink-0 items-center gap-2">
											<select
												value={item.status}
												class="rounded-md border-stone-300 text-sm shadow-sm focus:border-teal-600 focus:ring-teal-600"
												onchange={(event) =>
													updateStatus(item, event.currentTarget.value as QueueStatus)}
											>
												{#each queueStatuses as option}
													<option value={option.value}>{option.label}</option>
												{/each}
											</select>

											<button
												type="button"
												class="rounded-md border border-stone-300 px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
												onclick={() => startEditing(item)}
											>
												Edit
											</button>

											<button
												type="button"
												class="rounded-md border border-stone-300 px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
												onclick={() =>
													(pendingDeleteItemId =
														pendingDeleteItemId === item.id ? null : item.id)}
											>
												{pendingDeleteItemId === item.id ? 'Cancel' : 'Delete'}
											</button>
										</div>
									</div>

									{#if pendingDeleteItemId === item.id}
										<div class="mt-4 flex flex-col gap-3 rounded-md border border-red-200 bg-red-50 p-3 sm:flex-row sm:items-center sm:justify-between">
											<p class="text-sm text-red-900">Delete this item from your queue?</p>
											<button
												type="button"
												class="rounded-md bg-red-700 px-3 py-2 text-sm font-semibold text-white hover:bg-red-800"
												onclick={() => deleteItem(item)}
											>
												Confirm delete
											</button>
										</div>
									{/if}
								{/if}
							</article>
						{/each}
					</div>
				{/if}
			</section>
		{/if}

		{#if message}
			<p class="rounded-md border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-900 lg:col-span-2">
				{message}
			</p>
		{/if}

		{#if error}
			<p class="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 lg:col-span-2">
				{error}
			</p>
		{/if}
	</div>
</main>

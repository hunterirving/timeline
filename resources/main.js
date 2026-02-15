(() => {
	"use strict";

	const TICK = 5;
	const DEFAULT_START = 8 * 60;
	const DEFAULT_END = 20 * 60;
	const MIN_TIME = -4 * 60;
	const MAX_TIME = 32 * 60;
	const NEW_CHUNK_DURATION = 30;
	const TRACK_PAD = 24;
	const PILL_MERGE_PX = 16;

	const COLORS = [
		{ name: "slate",          var: "--slate" },
		{ name: "lobster",        var: "--lobster" },
		{ name: "bubble-yum",     var: "--bubble-yum" },
		{ name: "grape-soda",     var: "--grape-soda" },
		{ name: "blue-raspberry", var: "--blue-raspberry" },
		{ name: "bramble",        var: "--bramble" },
	];

	const state = {
		plan: [],
		actual: [],
		nextId: 1,
		selectedId: null,
		viewStart: DEFAULT_START,
		viewEnd: DEFAULT_END,
	};

	const planPane = document.getElementById("plan");
	const actualPane = document.getElementById("actual");
	const planColumn = planPane.querySelector(".column");
	const actualColumn = actualPane.querySelector(".column");
	const planTextArea = planPane.querySelector(".text-area");
	const actualTextArea = actualPane.querySelector(".text-area");
	const nowLine = document.getElementById("now-line");

	const textInput = document.createElement("input");
	textInput.id = "text-input";
	textInput.type = "text";
	document.body.appendChild(textInput);

	const rootStyles = getComputedStyle(document.documentElement);

	function getColor(colorIndex) {
		return rootStyles.getPropertyValue(COLORS[colorIndex].var).trim();
	}

	function minutesToTime(m) {
		let norm = ((m % 1440) + 1440) % 1440;
		let h = Math.floor(norm / 60);
		const mm = norm % 60;
		const ampm = h >= 12 ? "pm" : "am";
		if (h === 0) h = 12;
		else if (h > 12) h -= 12;
		return mm === 0 ? `${h}:00${ampm}` : `${h}:${String(mm).padStart(2, "0")}${ampm}`;
	}

	function snap(minutes) {
		return Math.round(minutes / TICK) * TICK;
	}

	function getColumnHeight() {
		return planColumn.clientHeight;
	}

	function timeToY(minutes) {
		const range = state.viewEnd - state.viewStart;
		return ((minutes - state.viewStart) / range) * getColumnHeight();
	}

	function yToTime(y) {
		const range = state.viewEnd - state.viewStart;
		return state.viewStart + (y / getColumnHeight()) * range;
	}

	function getChunks(side) {
		return side === "plan" ? state.plan : state.actual;
	}

	function getColumn(side) {
		return side === "plan" ? planColumn : actualColumn;
	}

	function chunkAtY(side, clientY) {
		const textArea = side === "plan" ? planTextArea : actualTextArea;
		const areaTop = textArea.getBoundingClientRect().top;
		for (const chunk of getChunks(side)) {
			const topPx = timeToY(chunk.start) + TRACK_PAD + areaTop;
			const botPx = timeToY(chunk.end) + TRACK_PAD + areaTop;
			if (clientY >= topPx && clientY <= botPx) return chunk;
		}
		return null;
	}

	function recalcView() {
		let min = DEFAULT_START;
		let max = DEFAULT_END;
		for (const chunk of [...state.plan, ...state.actual]) {
			if (chunk.start < min) min = chunk.start;
			if (chunk.end > max) max = chunk.end;
		}
		state.viewStart = min;
		state.viewEnd = max;
	}

	function render() {
		recalcView();
		document.getElementById("pill-layer").innerHTML = "";
		renderSide("plan");
		renderSide("actual");
		renderNowLine();

		const selectedSide = state.selectedId ? findChunkSide(state.selectedId) : null;
		planPane.style.zIndex = selectedSide === "plan" ? "2" : "0";
		actualPane.style.zIndex = selectedSide === "actual" ? "2" : "0";
	}

	function renderSide(side) {
		const chunks = getChunks(side);
		const column = getColumn(side);
		const textArea = side === "plan" ? planTextArea : actualTextArea;
		const isPlan = side === "plan";
		const pillLayer = document.getElementById("pill-layer");

		column.innerHTML = "";
		textArea.innerHTML = "";

		const boundarySet = new Set();
		for (const chunk of chunks) {
			boundarySet.add(chunk.start);
			boundarySet.add(chunk.end);
		}

		for (const chunk of chunks) {
			const top = timeToY(chunk.start);
			const height = timeToY(chunk.end) - top;
			const color = getColor(chunk.colorIndex);

			const el = document.createElement("div");
			el.className = "chunk" + (chunk.id === state.selectedId ? " selected" : "");
			el.style.top = top + "px";
			el.style.height = height + "px";
			el.style.backgroundColor = color;
			if (isPlan) {
				el.style.backgroundImage = "radial-gradient(circle, var(--bg) 0.8px, transparent 0.8px), radial-gradient(circle, var(--bg) 0.8px, transparent 0.8px)";
				el.style.backgroundSize = "3px 3px";
				el.style.backgroundPosition = "0 0, 1.5px 1.5px";
			}
			el.dataset.id = chunk.id;
			el.dataset.side = side;

			const handleTop = document.createElement("div");
			handleTop.className = "chunk-handle chunk-handle-top";
			handleTop.dataset.edge = "top";
			el.appendChild(handleTop);

			const handleBottom = document.createElement("div");
			handleBottom.className = "chunk-handle chunk-handle-bottom";
			handleBottom.dataset.edge = "bottom";
			el.appendChild(handleBottom);

			column.appendChild(el);

			const label = document.createElement("div");
			label.className = "chunk-label";
			label.style.top = (top + TRACK_PAD) + "px";
			label.style.height = height + "px";

			const span = document.createElement("span");
			span.textContent = chunk.text;
			label.appendChild(span);
			textArea.appendChild(label);

			if (chunk.text) {
				fitText(span, height);
			}
		}

		if (!pillLayer) return;

		const pills = [...boundarySet]
			.map(t => ({ time: t, y: timeToY(t) }))
			.sort((a, b) => a.y - b.y);

		const merged = [];
		for (const p of pills) {
			if (merged.length > 0) {
				const last = merged[merged.length - 1];
				const lastMaxY = Math.max(...last.map(item => item.y));
				if (Math.abs(p.y - lastMaxY) < PILL_MERGE_PX) {
					last.push(p);
					continue;
				}
			}
			merged.push([p]);
		}

		for (const group of merged) {
			const avgY = group.reduce((sum, p) => sum + p.y, 0) / group.length;
			const text = group.map(p => minutesToTime(p.time)).join(" \u00B7 ");

			const pill = document.createElement("div");
			pill.className = "time-pill";
			pill.style.top = (avgY + TRACK_PAD) + "px";
			pill.style.left = side === "plan" ? "calc(50vw - 36px)" : "calc(50vw + 36px)";
			pill.textContent = text;
			pillLayer.appendChild(pill);
		}
	}

	function fitText(span, maxHeight) {
		requestAnimationFrame(() => {
			let lo = 8;
			let hi = Math.min(64, maxHeight);
			span.style.fontSize = hi + "px";
			if (span.scrollHeight <= maxHeight) return;
			while (hi - lo > 1) {
				const mid = Math.floor((lo + hi) / 2);
				span.style.fontSize = mid + "px";
				if (span.scrollHeight <= maxHeight) lo = mid;
				else hi = mid;
			}
			span.style.fontSize = lo + "px";
			if (span.scrollHeight > maxHeight) span.style.display = "none";
		});
	}

	function renderNowLine() {
		const now = new Date();
		const nowMin = now.getHours() * 60 + now.getMinutes();
		if (nowMin >= state.viewStart && nowMin <= state.viewEnd) {
			nowLine.style.display = "block";
			nowLine.style.top = (timeToY(nowMin) + TRACK_PAD) + "px";
		} else {
			nowLine.style.display = "none";
		}
	}

	function createChunk(e, side) {
		const column = getColumn(side);
		const rect = column.getBoundingClientRect();
		const y = e.clientY - rect.top;
		const clickTime = snap(yToTime(y));
		let start = clickTime;
		let end = clickTime + NEW_CHUNK_DURATION;
		const chunks = getChunks(side);

		if (start < MIN_TIME || start >= MAX_TIME) return;

		for (const c of chunks) {
			if (start >= c.start && start < c.end) return;
		}

		const sorted = [...chunks].sort((a, b) => a.start - b.start);

		// Clamp end downward: find nearest chunk or boundary below clickTime
		let maxEnd = MAX_TIME;
		for (const c of sorted) {
			if (c.start > start) { maxEnd = c.start; break; }
		}
		end = Math.min(end, maxEnd);

		// If we couldn't get the full duration downward, expand upward
		const shortfall = NEW_CHUNK_DURATION - (end - start);
		if (shortfall > 0) {
			let minStart = MIN_TIME;
			for (let i = sorted.length - 1; i >= 0; i--) {
				if (sorted[i].end <= start) { minStart = sorted[i].end; break; }
			}
			start = Math.max(minStart, snap(start - shortfall));
		}

		end = snap(end);
		start = snap(start);
		if (end - start < TICK) return;

		const chunk = { id: state.nextId++, start, end, text: "", colorIndex: 0 };
		chunks.push(chunk);
		state.selectedId = chunk.id;
		render();
		textInput.value = "";
		setTimeout(() => textInput.focus(), 0);
	}

	function selectChunk(id) {
		state.selectedId = id;
		render();
		const chunk = findChunkById(id);
		if (chunk) {
			textInput.value = chunk.text;
			textInput.focus();
		}
	}

	function deselectAll() {
		if (state.selectedId === null) return;
		state.selectedId = null;
		textInput.blur();
		render();
	}

	function findChunkById(id) {
		return state.plan.find(c => c.id === id) || state.actual.find(c => c.id === id);
	}

	function findChunkSide(id) {
		if (state.plan.find(c => c.id === id)) return "plan";
		if (state.actual.find(c => c.id === id)) return "actual";
		return null;
	}

	function deleteChunk(id) {
		const side = findChunkSide(id);
		if (!side) return;
		const chunks = getChunks(side);
		const idx = chunks.findIndex(c => c.id === id);
		if (idx !== -1) chunks.splice(idx, 1);
		if (state.selectedId === id) state.selectedId = null;
		render();
	}

	let drag = null;

	function startDrag(e, chunkId, side, mode, edge) {
		e.preventDefault();
		const chunk = findChunkById(chunkId);

		const column = getColumn(side);
		const rect = column.getBoundingClientRect();
		const mouseTime = yToTime(e.clientY - rect.top);

		drag = {
			chunkId, side, mode, edge,
			mouseStartTime: mouseTime,
			origStart: chunk.start,
			origEnd: chunk.end,
		};
		if (mode === "move") document.body.classList.add("dragging");
	}

	function onMouseMove(e) {
		if (!drag) return;
		const chunk = findChunkById(drag.chunkId);
		if (!chunk) { drag = null; return; }

		// Detect cross-track movement during a move drag
		if (drag.mode === "move") {
			const midX = window.innerWidth / 2;
			const targetSide = e.clientX < midX ? "plan" : "actual";
			if (targetSide !== drag.side) {
				const sourceChunks = getChunks(drag.side);
				const idx = sourceChunks.findIndex(c => c.id === drag.chunkId);
				if (idx !== -1) {
					sourceChunks.splice(idx, 1);
					getChunks(targetSide).push(chunk);
					drag.side = targetSide;
				}
			}
		}

		const column = getColumn(drag.side);
		const rect = column.getBoundingClientRect();
		const currentTime = yToTime(e.clientY - rect.top);
		const dMin = snap(currentTime - drag.mouseStartTime);

		const chunks = getChunks(drag.side);
		const others = chunks.filter(c => c.id !== drag.chunkId).sort((a, b) => a.start - b.start);

		if (drag.mode === "move") {
			const dur = drag.origEnd - drag.origStart;
			let s = drag.origStart + dMin;
			let en = s + dur;

			if (s < MIN_TIME) { s = MIN_TIME; en = s + dur; }
			if (en > MAX_TIME) { en = MAX_TIME; s = en - dur; }

			const cursorTime = yToTime(e.clientY - rect.top);
			let overlaps = false;
			for (const c of others) {
				if (s < c.end && en > c.start) { overlaps = true; break; }
			}
			if (overlaps) {
				// Build list of gaps between existing chunks that can fit dur
				const gaps = [];
				let gapStart = MIN_TIME;
				for (const c of others) {
					const gapEnd = c.start;
					if (gapEnd - gapStart >= dur) gaps.push({ start: gapStart, end: gapEnd });
					gapStart = c.end;
				}
				if (MAX_TIME - gapStart >= dur) gaps.push({ start: gapStart, end: MAX_TIME });

				// For each gap, find the best placement (closest to cursor)
				let bestS = null, bestDist = Infinity;
				for (const gap of gaps) {
					// Clamp the desired start within this gap
					const gapS = Math.max(gap.start, Math.min(s, gap.end - dur));
					const gapE = gapS + dur;
					// Distance from cursor to the center of where the chunk would land
					const center = (gapS + gapE) / 2;
					const dist = Math.abs(cursorTime - center);
					if (dist < bestDist) {
						bestDist = dist;
						bestS = gapS;
					}
				}
				if (bestS !== null) {
					s = bestS; en = s + dur;
				}
			}
			if (s < MIN_TIME) { s = MIN_TIME; en = s + dur; }
			if (en > MAX_TIME) { en = MAX_TIME; s = en - dur; }

			let valid = true;
			for (const c of others) {
				if (s < c.end && en > c.start) { valid = false; break; }
			}

			if (valid) {
				chunk.start = s;
				chunk.end = en;
			}
		} else {
			if (drag.edge === "top") {
				let s = snap(drag.origStart + dMin);
				s = Math.max(MIN_TIME, s);
				s = Math.min(chunk.end - TICK, s);
				for (const c of others) {
					if (c.end > s && c.end <= chunk.end) s = c.end;
				}
				chunk.start = s;
			} else {
				let en = snap(drag.origEnd + dMin);
				en = Math.min(MAX_TIME, en);
				en = Math.max(chunk.start + TICK, en);
				for (const c of others) {
					if (c.start < en && c.start >= chunk.start) en = c.start;
				}
				chunk.end = en;
			}
		}

		render();
	}

	function onMouseUp() {
		if (drag) {
			drag = null;
			document.body.classList.remove("dragging");
			render();
		}
	}

	const SCROLL_THRESHOLD = 50;
	const COLOR_WIPE_PX_PER_MS = 3;
	const COLOR_WIPE_MIN_MS = 80;
	let scrollAccum = 0;
	let colorTransitionActive = false;

	function onWheel(e) {
		const chunkEl = e.target.closest(".chunk");
		if (!chunkEl) return;

		e.preventDefault();
		if (colorTransitionActive) return;

		const id = Number(chunkEl.dataset.id);
		const chunk = findChunkById(id);
		if (!chunk) return;

		const side = findChunkSide(id);

		scrollAccum += e.deltaY;
		if (Math.abs(scrollAccum) >= SCROLL_THRESHOLD) {
			const dir = scrollAccum > 0 ? 1 : -1;
			const newColorIndex = ((chunk.colorIndex + dir) % COLORS.length + COLORS.length) % COLORS.length;
			scrollAccum = 0;

			const oldColor = getColor(chunk.colorIndex);
			const newColor = getColor(newColorIndex);
			const fromTop = dir < 0;

			selectChunk(id);

			const col = getColumn(side);
			const activeEl = col.querySelector(`.chunk[data-id="${id}"]`);
			const chunkHeight = activeEl.offsetHeight;
			const duration = Math.max(Math.sqrt(chunkHeight) / COLOR_WIPE_PX_PER_MS * 20, COLOR_WIPE_MIN_MS);

			const isPlanChunk = side === "plan";
			const halftone = "radial-gradient(circle, var(--bg) 0.8px, transparent 0.8px), radial-gradient(circle, var(--bg) 0.8px, transparent 0.8px)";

			colorTransitionActive = true;
			activeEl.style.transition = "none";
			const wipeGrad = fromTop
				? `linear-gradient(to bottom, ${newColor} 0%, ${oldColor} 0%)`
				: `linear-gradient(to top, ${newColor} 0%, ${oldColor} 0%)`;
			activeEl.style.backgroundImage = isPlanChunk ? `${halftone}, ${wipeGrad}` : wipeGrad;
			activeEl.style.backgroundSize = isPlanChunk ? "3px 3px, 3px 3px, 100% 100%" : "";
			if (isPlanChunk) activeEl.style.backgroundPosition = "0 0, 1.5px 1.5px, 0 0";
			activeEl.style.backgroundColor = "transparent";

			let start = null;
			function animate(ts) {
				if (!start) start = ts;
				const progress = Math.min((ts - start) / duration, 1);
				const pct = progress * 100;
				const wipe = fromTop
					? `linear-gradient(to bottom, ${newColor} ${pct}%, ${oldColor} ${pct}%)`
					: `linear-gradient(to top, ${newColor} ${pct}%, ${oldColor} ${pct}%)`;
				activeEl.style.backgroundImage = isPlanChunk ? `${halftone}, ${wipe}` : wipe;
				if (isPlanChunk) activeEl.style.backgroundPosition = "0 0, 1.5px 1.5px, 0 0";
				if (progress < 1) {
					requestAnimationFrame(animate);
				} else {
					chunk.colorIndex = newColorIndex;
					colorTransitionActive = false;
					if (isPlanChunk) {
						activeEl.style.backgroundImage = halftone;
						activeEl.style.backgroundSize = "3px 3px";
						activeEl.style.backgroundPosition = "0 0, 1.5px 1.5px";
					} else {
						activeEl.style.backgroundImage = "";
						activeEl.style.backgroundSize = "";
					}
					activeEl.style.backgroundColor = newColor;
				}
			}
			requestAnimationFrame(animate);
		}
	}

	textInput.addEventListener("input", () => {
		const chunk = findChunkById(state.selectedId);
		if (chunk) {
			chunk.text = textInput.value;
			render();
			textInput.focus();
		}
	});

	function pinCursorToEnd() {
		const len = textInput.value.length;
		textInput.setSelectionRange(len, len);
	}

	textInput.addEventListener("keydown", (e) => {
		if (e.key === "ArrowLeft" || e.key === "ArrowRight" || e.key === "Home") {
			e.preventDefault();
		}
	});
	textInput.addEventListener("select", pinCursorToEnd);
	textInput.addEventListener("click", pinCursorToEnd);
	textInput.addEventListener("focus", pinCursorToEnd);

	let mailtoNavigating = false;

	window.addEventListener("beforeunload", (e) => {
		if (mailtoNavigating) return;
		if (state.plan.length > 0 || state.actual.length > 0) {
			e.preventDefault();
		}
	});

	const copyFeedback = document.createElement("div");
	copyFeedback.className = "copy-feedback";
	copyFeedback.textContent = "Copied link to clipboard";
	document.body.appendChild(copyFeedback);

	function showCopyFeedback() {
		copyFeedback.classList.remove("fade-out");
		copyFeedback.classList.add("show");
		setTimeout(() => {
			copyFeedback.classList.remove("show");
			copyFeedback.classList.add("fade-out");
		}, 1000);
	}

	async function copyTimelineLink() {
		const allChunks = [...state.plan, ...state.actual];
		if (allChunks.length === 0) return;
		const encoded = await window.__timeline_codec.encodeTimeline(state.plan, state.actual);
		if (!encoded) return;
		const base = window.location.origin + window.location.pathname;
		const link = base + "?d=" + encoded;
		await navigator.clipboard.writeText(link);
		showCopyFeedback();
	}

	async function sendTimelineEmail() {
		mailtoNavigating = true;
		await window.__timeline_email.sendTimelineEmail(state.plan, state.actual);
		setTimeout(() => { mailtoNavigating = false; }, 1000);
	}

	document.addEventListener("keydown", (e) => {
		if (e.key === "Shift") document.body.classList.add("shift-held");
		if (e.key === "Escape") {
			deselectAll();
			return;
		}
		if (e.key === "c" && (e.metaKey || e.ctrlKey)) {
			e.preventDefault();
			copyTimelineLink();
			return;
		}
		if (e.key === "m" && (e.metaKey || e.ctrlKey)) {
			e.preventDefault();
			sendTimelineEmail();
			return;
		}
		if ((e.key === "Delete" || e.key === "Backspace") && state.selectedId && document.activeElement !== textInput) {
			deleteChunk(state.selectedId);
		}
	});

	document.addEventListener("keyup", (e) => {
		if (e.key === "Shift") document.body.classList.remove("shift-held");
	});

	document.addEventListener("mousedown", (e) => {
		const chunkEl = e.target.closest(".chunk");
		const textAreaEl = e.target.closest(".text-area");

		if (chunkEl) {
			const id = Number(chunkEl.dataset.id);
			const side = chunkEl.dataset.side;

			if (e.shiftKey) {
				deleteChunk(id);
				e.preventDefault();
				return;
			}

			const handleEl = e.target.closest(".chunk-handle");
			if (handleEl) {
				selectChunk(id);
				startDrag(e, id, side, "resize", handleEl.dataset.edge);
			} else {
				selectChunk(id);
				startDrag(e, id, side, "move", null);
			}
			return;
		}

		if (textAreaEl) {
			const side = textAreaEl.closest("#plan") ? "plan" : "actual";
			const hit = chunkAtY(side, e.clientY);
			if (hit) {
				if (e.shiftKey) {
					deleteChunk(hit.id);
					e.preventDefault();
					return;
				}
				selectChunk(hit.id);
				setTimeout(() => textInput.focus(), 0);
				return;
			}
		}

		const columnEl = e.target.closest(".column");
		if (columnEl) {
			const side = columnEl.closest("#plan") ? "plan" : "actual";
			deselectAll();
			createChunk(e, side);
			return;
		}

		deselectAll();
	});

	planColumn.addEventListener("wheel", onWheel, { passive: false });
	actualColumn.addEventListener("wheel", onWheel, { passive: false });

	document.addEventListener("mousemove", onMouseMove);
	document.addEventListener("mouseup", onMouseUp);

	function setupTextAreaCursor(side) {
		const textArea = side === "plan" ? planTextArea : actualTextArea;
		textArea.addEventListener("mousemove", (e) => {
			const hit = chunkAtY(side, e.clientY);
			textArea.style.cursor = hit ? "text" : "";
		});
		textArea.addEventListener("mouseleave", () => {
			textArea.style.cursor = "";
		});
	}
	setupTextAreaCursor("plan");
	setupTextAreaCursor("actual");

	const planTrack = planPane.querySelector(".column-track");
	const actualTrack = actualPane.querySelector(".column-track");

	planTrack.addEventListener("mouseenter", () => document.body.classList.add("tracks-hover"));
	planTrack.addEventListener("mouseleave", () => document.body.classList.remove("tracks-hover"));
	actualTrack.addEventListener("mouseenter", () => document.body.classList.add("tracks-hover"));
	actualTrack.addEventListener("mouseleave", () => document.body.classList.remove("tracks-hover"));

	document.documentElement.addEventListener("mouseleave", () => deselectAll());

	const chimeAudio = new Audio("resources/chime.mp3");
	const chimedEvents = new Set();

	function checkChimes() {
		const now = new Date();
		const nowMin = now.getHours() * 60 + now.getMinutes();
		for (const chunk of state.plan) {
			const key = chunk.id + ":" + chunk.start;
			if (chunk.start === nowMin && !chimedEvents.has(key)) {
				chimedEvents.add(key);
				chimeAudio.currentTime = 0;
				chimeAudio.play();
			}
		}
	}

	setInterval(() => {
		renderNowLine();
		checkChimes();
	}, 5000);

	const urlParams = new URLSearchParams(window.location.search);
	const encoded = urlParams.get("d");
	if (encoded) {
		window.__timeline_codec.decodeTimeline(encoded).then(({ plan, actual }) => {
			for (const chunk of plan) {
				chunk.id = state.nextId++;
				state.plan.push(chunk);
			}
			for (const chunk of actual) {
				chunk.id = state.nextId++;
				state.actual.push(chunk);
			}
			render();
		});
	}

	render();
	checkChimes();
	window.addEventListener("resize", render);
})();

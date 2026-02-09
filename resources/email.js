(() => {
	"use strict";

	function wordWrap(str, maxLen) {
		if (str.length <= maxLen) return [str];
		const lines = [];
		let remaining = str;
		while (remaining.length > maxLen) {
			let breakAt = -1;
			for (let i = maxLen; i >= 0; i--) {
				if (/[\s\-_\/\\,;:!?)}\]]/.test(remaining[i])) {
					breakAt = i + 1;
					break;
				}
			}
			if (breakAt <= 0) breakAt = maxLen;
			lines.push(remaining.slice(0, breakAt));
			remaining = remaining.slice(breakAt).replace(/^\s+/, "");
		}
		if (remaining) lines.push(remaining);
		return lines;
	}

	function buildEmailBody(chunks, tick, minutesToTime) {
		const sorted = [...chunks].sort((a, b) => a.start - b.start);
		if (sorted.length === 0) return null;

		const earliest = sorted[0].start;
		const latest = sorted[sorted.length - 1].end;

		const chunkAt = (t) => sorted.find(c => t >= c.start && t < c.end) || null;
		const LINE_MAX = 130;

		const chunkMeta = new Map();
		for (const chunk of sorted) {
			const totalLines = (chunk.end - chunk.start) / tick;
			const label = chunk.text || "";

			if (totalLines === 1) {
				chunkMeta.set(chunk.id, { textByLine: new Map(), currentLine: 0 });
				continue;
			}

			const interiorCount = totalLines - 2;
			let wrapped = wordWrap(label, LINE_MAX);
			const availableLines = Math.max(0, interiorCount);

			if (wrapped.length > availableLines) {
				const kept = wrapped.slice(0, availableLines);
				if (kept.length > 0 && availableLines < wrapped.length) {
					const lastLine = kept[kept.length - 1];
					const maxLast = LINE_MAX - 1;
					kept[kept.length - 1] = lastLine.length > maxLast
						? lastLine.slice(0, maxLast) + "\u2026"
						: lastLine + "\u2026";
				}
				wrapped = kept;
			}

			const textBlockSize = wrapped.length;
			const startOffset = Math.floor((availableLines - textBlockSize) / 2);

			const textByLine = new Map();
			for (let i = 0; i < wrapped.length; i++) {
				textByLine.set(startOffset + i, wrapped[i]);
			}

			chunkMeta.set(chunk.id, { textByLine, currentLine: 0 });
		}

		const lines = [];
		for (let t = earliest; t < latest; t += tick) {
			const chunk = chunkAt(t);
			const isStart = chunk && t === chunk.start;
			const isEnd = chunk && t + tick === chunk.end;
			const isSingle = isStart && isEnd;

			let glyph;
			if (!chunk) {
				glyph = " ";
			} else if (isSingle) {
				glyph = "\u00B7";
			} else if (isStart) {
				glyph = "\u256D";
			} else if (isEnd) {
				glyph = "\u2570";
			} else {
				glyph = "\u2502";
			}

			let text = "";
			if (chunk) {
				const meta = chunkMeta.get(chunk.id);
				if (isSingle) {
					const label = chunk.text || "";
					const prefix = minutesToTime(chunk.start) + "\u2013" + minutesToTime(chunk.end) + " ";
					const maxLabel = LINE_MAX - prefix.length - 2;
					const truncLabel = label.length > maxLabel ? label.slice(0, maxLabel) + "\u2026" : label;
					text = " " + prefix + truncLabel;
				} else if (isStart) {
					const totalLines = (chunk.end - chunk.start) / tick;
					if (totalLines === 2) {
						const label = chunk.text || "";
						const timeStr = minutesToTime(chunk.start);
						const maxLabel = LINE_MAX - timeStr.length - 3;
						const truncLabel = label.length > maxLabel ? label.slice(0, maxLabel) + "\u2026" : label;
						text = " " + timeStr + (truncLabel ? " " + truncLabel : "");
					} else {
						text = " " + minutesToTime(chunk.start);
					}
				} else if (isEnd) {
					text = " " + minutesToTime(chunk.end);
				} else {
					const interiorIdx = meta.currentLine;
					const lineText = meta.textByLine.get(interiorIdx);
					if (lineText) {
						text = " " + lineText;
					}
				}
				if (!isStart && !isEnd && !isSingle) meta.currentLine++;
			}

			lines.push(glyph + text);
		}

		return lines.join("\n");
	}

	function sendTimelineEmail(chunks, tick, minutesToTime) {
		const body = buildEmailBody(chunks, tick, minutesToTime);
		if (!body) return;

		const today = new Date();
		const subject = "timeline \u00B7 " + today.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
		const mailto = "mailto:"
			+ "?subject=" + encodeURIComponent(subject)
			+ "&body=" + encodeURIComponent(body);

		window.location.href = mailto;
	}

	window.__timeline_email = { buildEmailBody, sendTimelineEmail };
})();

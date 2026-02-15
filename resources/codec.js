(() => {
	"use strict";

	function stringify(plan, actual) {
		const lines = [];
		for (const chunk of plan) {
			const text = (chunk.text || "").replace(/\t/g, " ");
			lines.push(`p\t${chunk.colorIndex}\t${chunk.start}\t${chunk.end}\t${text}`);
		}
		for (const chunk of actual) {
			const text = (chunk.text || "").replace(/\t/g, " ");
			lines.push(`a\t${chunk.colorIndex}\t${chunk.start}\t${chunk.end}\t${text}`);
		}
		return lines.join("\n");
	}

	function parse(str) {
		const plan = [];
		const actual = [];
		for (const line of str.split("\n")) {
			if (!line) continue;
			const parts = line.split("\t");
			if (parts.length < 4) continue;
			const track = parts[0];
			const colorIndex = parseInt(parts[1], 10);
			const start = parseInt(parts[2], 10);
			const end = parseInt(parts[3], 10);
			const text = parts.slice(4).join("\t");
			if (isNaN(colorIndex) || isNaN(start) || isNaN(end)) continue;
			const chunk = { start, end, text, colorIndex };
			if (track === "p") plan.push(chunk);
			else actual.push(chunk);
		}
		return { plan, actual };
	}

	async function compress(str) {
		const encoder = new TextEncoder();
		const stream = new Blob([encoder.encode(str)])
			.stream()
			.pipeThrough(new CompressionStream("deflate-raw"));
		const buf = await new Response(stream).arrayBuffer();
		return buf;
	}

	async function decompress(buf) {
		const stream = new Blob([buf])
			.stream()
			.pipeThrough(new DecompressionStream("deflate-raw"));
		return await new Response(stream).text();
	}

	function toBase64url(buf) {
		const bytes = new Uint8Array(buf);
		let binary = "";
		for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
		return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
	}

	function fromBase64url(str) {
		const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
		const pad = (4 - (base64.length % 4)) % 4;
		const padded = base64 + "=".repeat(pad);
		const binary = atob(padded);
		const bytes = new Uint8Array(binary.length);
		for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
		return bytes.buffer;
	}

	async function encodeTimeline(plan, actual) {
		const str = stringify(plan, actual);
		if (!str) return null;
		const buf = await compress(str);
		return toBase64url(buf);
	}

	async function decodeTimeline(encoded) {
		const buf = fromBase64url(encoded);
		const str = await decompress(buf);
		return parse(str);
	}

	window.__timeline_codec = { encodeTimeline, decodeTimeline };
})();

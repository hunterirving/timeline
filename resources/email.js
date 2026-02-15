(() => {
	"use strict";

	async function sendTimelineEmail(plan, actual) {
		const allChunks = [...plan, ...actual];
		if (allChunks.length === 0) return;

		const encoded = await window.__timeline_codec.encodeTimeline(plan, actual);
		if (!encoded) return;

		const base = window.location.origin + window.location.pathname;
		const link = base + "?d=" + encoded;

		const today = new Date();
		const subject = "timeline \u00B7 " + today.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
		const mailto = "mailto:"
			+ "?subject=" + encodeURIComponent(subject)
			+ "&body=" + encodeURIComponent(link);

		window.location.href = mailto;
	}

	window.__timeline_email = { sendTimelineEmail };
})();

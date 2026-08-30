import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";


async function render(pathname = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${pathname}`, { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}


test("makes Who Said It the primary app", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Regulation Who Said It<\/title>/i);
  assert.doesNotMatch(html, /60 real quotes \/ four possible hosts/i);
  assert.match(html, /Made by community member Michael Booth/i);
  assert.match(html, /Nick isn(?:&#x27;|')t included because he does not talk enough/i);
  assert.match(html, /Start the regulation quiz/i);
  assert.match(html, /regulation-brand-mark/i);
  assert.match(html, /415<!-- --> episodes digested/i);
  assert.match(html, /<dt>Quote bank<\/dt><dd>100<\/dd>/i);
  assert.doesNotMatch(html, /href="\/who-said-it\/bank"[^>]*>Quote bank/i);
  assert.doesNotMatch(html, /FRIENDSHIP|EMBRACING ABSURDITY|REAL TRANSCRIPTS|ONE HAM TOWER/i);
  for (const host of ["Geoff", "Andrew", "Gavin", "Eric"]) {
    assert.match(html, new RegExp(host));
  }
  assert.doesNotMatch(html, /Which mic|Begin the investigation|Host quiz|Question bank/i);
});


test("keeps the old question-bank URL hidden behind the quote bank", async () => {
  const response = await render("/questions");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<title>Quote Bank \| Regulation Who Said It<\/title>/i);
  assert.match(html, /All <!-- -->100<!-- --> absurd lines/i);
  assert.match(html, /Search quotes, episodes, or context/i);
  assert.doesNotMatch(html, /All <!-- -->39<!-- --> bad decisions|host-by-host question bank/i);
});


test("server-renders the dedicated Who Said It route", async () => {
  const response = await render("/who-said-it");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<title>Regulation Who Said It<\/title>/i);
  assert.match(html, /Made by community member Michael Booth/i);
  assert.match(html, /<dt>Quote bank<\/dt><dd>100<\/dd>/i);
  assert.match(html, /<dt>Rounds served<\/dt><dd>10<\/dd>/i);
  assert.match(html, /I have a 50-foot ham tower/i);
});


test("server-renders the Regulation Fill in the Blank game", async () => {
  const response = await render("/blank");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<title>Regulation Fill in the Blank<\/title>/i);
  assert.match(html, /fill in the blank/i);
  assert.match(html, /Reconstruct ten absurd lines from the show(?:&#x27;|')s history/i);
  assert.match(html, /Open the damaged transcript/i);
  assert.match(html, /three lines before it and identifies who said it/i);
  assert.match(html, /Every blank removes the memorable one-to-three-word punchline/i);
  assert.match(html, /game of catch/i);
  assert.match(html, /lobster-claw mitts/i);
  assert.match(html, /hot dog gloves/i);
  assert.doesNotMatch(html, /every morning/i);
  assert.match(html, /<dt>Question bank<\/dt><dd>50<\/dd>/i);
  assert.match(html, /href="\/blank\/bank"[^>]*>Review bank<\/a>/i);
  assert.match(html, /href="\/"[^>]*>Who said it<\/a>/i);
});


test("server-renders the complete fill-in-the-blank review desk", async () => {
  const response = await render("/blank/bank");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<title>Fill in the Blank Bank \| Regulation Who Said It<\/title>/i);
  assert.match(html, /Review all <strong>50<\/strong> damaged files/i);
  assert.match(html, /Search blanks, answers, decoys, episodes, or IDs/i);
  assert.match(html, /Showing <strong>50<\/strong> of (?:<!-- -->)?50/i);
  assert.equal((html.match(/class="blank-bank-card"/g) ?? []).length, 50);
  assert.equal((html.match(/Correct repair/g) ?? []).length, 50);
  assert.match(html, /Mark for removal/i);
  assert.match(html, /Copy removal list/i);
  assert.match(html, /Open transcript context/i);
  assert.match(html, /punchline-geoff-hot-dog-gloves/i);
  assert.match(html, /punchline-gavin-news-waffle/i);
  assert.match(html, /Correct repair[^]*hot dog gloves/i);
  assert.match(html, /Marks live in this browser/i);
});


test("keeps the fill-in-the-blank bank curated and transcript-grounded", async () => {
  const [blankText, quoteText, extraQuoteText, speakerMapText, component, roundSource, preferencesSource, bankBrowserSource, styles] = await Promise.all([
    readFile(new URL("../app/data/fill-blank-bank.json", import.meta.url), "utf8"),
    readFile(new URL("../app/data/who-said-it-bank.json", import.meta.url), "utf8"),
    readFile(new URL("../app/data/fill-blank-extra-sources.json", import.meta.url), "utf8"),
    readFile(new URL("../../data/speaker_map.json", import.meta.url), "utf8"),
    readFile(new URL("../app/FillBlankGame.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/fill-blank-round.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/fill-blank-preferences.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/FillBlankBankBrowser.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  const blankBank = JSON.parse(blankText);
  const sharedQuoteBank = JSON.parse(quoteText);
  const extraQuoteBank = JSON.parse(extraQuoteText);
  const speakerMap = JSON.parse(speakerMapText);
  const quoteBank = [...sharedQuoteBank, ...extraQuoteBank];
  const quoteById = new Map(quoteBank.map((quote) => [quote.id, quote]));

  assert.equal(blankBank.length, 50);
  assert.equal(new Set(blankBank.map((item) => item.id)).size, 50);
  assert.equal(new Set(blankBank.map((item) => item.quoteId)).size, 50);
  assert.ok(blankBank.every((item) => item.id.startsWith("punchline-")));
  const retiredSourceIds = new Set([
    "geoff-egg-economy",
    "geoff-gentle-ghost",
    "geoff-twelve-foot-toilet",
    "geoff-third-bread",
    "geoff-sleeping-pill-horse",
    "geoff-poop-two-chairs",
    "geoff-global-flush",
    "geoff-potato-ass-chips",
    "geoff-animal-waste-ranking",
    "geoff-shirt-physics",
    "geoff-banana-diet",
    "geoff-rabbit-spaghetti",
    "andrew-seventy-five-sauces",
    "andrew-piss-dog",
    "andrew-egg-window",
    "andrew-hot-dog-cannon",
    "andrew-horse-egg",
    "andrew-sixty-four-bananas",
    "andrew-potatoast",
    "andrew-ostrich-sandwich",
    "andrew-collapsing-toilet",
    "andrew-ham-currency",
    "andrew-swan-dna",
    "andrew-egg-measurement",
    "andrew-cosmic-fart-protest",
    "gavin-boiled-fish",
    "gavin-ham-inside-pig",
    "gavin-fruit-bagel",
    "gavin-pencil-ice-pick",
    "gavin-sausage-flag",
    "gavin-puffer-fish",
    "gavin-pickle-paste",
    "gavin-cross-year-turd",
    "gavin-upstairs-toilet",
    "gavin-stick-on-funnel",
    "gavin-ankle-trousers",
    "gavin-anus-curtain",
    "gavin-vanishing-dog",
    "eric-two-headed-bird",
    "eric-guitar-egg",
    "eric-no-ding",
    "eric-flip-a-bird",
    "eric-deer-piss-review",
    "eric-bean-hole-tent",
    "eric-gooch-dog",
    "eric-electric-toilet",
    "eric-bank-floor",
    "eric-sausage-bop",
    "eric-icy-hot-fastball",
    "eric-ham-tower",
  ]);
  assert.deepEqual(
    blankBank.filter((item) => retiredSourceIds.has(item.quoteId)).map((item) => item.quoteId),
    [],
    "the rebuilt bank must not recycle any source quote from the retired edition",
  );
  assert.equal(extraQuoteBank.length, 16);
  assert.equal(new Set(extraQuoteBank.map((source) => source.id)).size, extraQuoteBank.length);
  assert.deepEqual(
    extraQuoteBank.filter((source) => sharedQuoteBank.some((shared) => shared.id === source.id)),
    [],
  );
  assert.ok(extraQuoteBank.every((source) => (
    source.sourceFile
    && Number.isInteger(source.segmentIndex)
    && source.endSec > source.startSec
    && source.leadIn.length === 3
    && source.leadIn.every((line) => line.speaker && line.text && line.startSec < source.startSec)
  )));
  const globalSpeakerByHost = { geoff: "G01", andrew: "G02", gavin: "G03", eric: "G04" };
  for (const source of extraQuoteBank) {
    const transcriptText = await readFile(
      new URL(`../../data/transcripts/${source.sourceFile}`, import.meta.url),
      "utf8",
    );
    const transcript = JSON.parse(transcriptText);
    const segment = transcript.segments[source.segmentIndex];
    assert.equal(segment.text.trim(), source.quote, `${source.id} must preserve the exact transcript text`);
    assert.equal(segment.start, source.startSec, `${source.id} must preserve the transcript timestamp`);
    assert.equal(
      speakerMap.episodes[String(source.episode)][segment.speaker],
      globalSpeakerByHost[source.speaker],
      `${source.id} must preserve the canonical speaker mapping`,
    );
  }
  assert.deepEqual(
    Object.fromEntries(
      ["easy", "medium", "hard"].map((difficulty) => [
        difficulty,
        blankBank.filter((item) => item.difficulty === difficulty).length,
      ]),
    ),
    { easy: 10, medium: 20, hard: 20 },
  );

  assert.deepEqual(
    Object.fromEntries(
      ["geoff", "andrew", "gavin", "eric"].map((speaker) => [
        speaker,
        blankBank.filter((item) => quoteById.get(item.quoteId)?.speaker === speaker).length,
      ]),
    ),
    { geoff: 13, andrew: 12, gavin: 12, eric: 13 },
  );

  for (const item of blankBank) {
    const source = quoteById.get(item.quoteId);
    assert.ok(source, `Missing source quote for ${item.id}`);
    const prompt = item.excerpt ?? source.quote;
    assert.ok(source.quote.includes(prompt), `${item.id} excerpt must be verbatim`);
    assert.ok(prompt.length <= 145, `${item.id} prompt is too long (${prompt.length})`);
    assert.equal(prompt.split(item.answer).length - 1, 1, `${item.id} must blank one exact span`);
    assert.equal(item.distractors.length, 3);
    assert.equal(new Set(item.distractors.map((distractor) => distractor.toLowerCase())).size, 3);
    const options = [item.answer, ...item.distractors];
    assert.equal(
      new Set(options.map((option) => option.toLowerCase())).size,
      4,
    );
    for (const option of options) {
      assert.equal(option, option.trim(), `${item.id} has padded choice text`);
      const wordCount = option.trim().split(/\s+/).length;
      assert.ok(wordCount >= 1 && wordCount <= 3, `${item.id} choice has ${wordCount} words: ${option}`);
    }
  }
  const retiredFillerAnswers = new Set(["I'm assuming", "I guess", "I think", "apparently"]);
  assert.deepEqual(
    blankBank.filter((item) => retiredFillerAnswers.has(item.answer)).map((item) => item.id),
    [],
  );

  assert.match(roundSource, /easy:\s*3/);
  assert.match(roundSource, /medium:\s*4/);
  assert.match(roundSource, /hard:\s*3/);
  assert.match(roundSource, /avoidIds/);
  assert.match(roundSource, /removalIds/);
  assert.match(roundSource, /fresh and marked/i);
  assert.match(component, /readBlankRemovalIds/);
  assert.match(component, /pickBlankRound\(avoidIds, removalIds\)/);
  assert.match(component, /Three preceding transcript lines followed by the restored quote/);
  assert.match(component, /Said by \{correctProfile\.name\}/);
  assert.match(component, /handleShortcut/);
  assert.match(component, /window\.localStorage/);
  assert.match(component, /archive punchline reconstruction/);
  assert.doesNotMatch(component, /\{source\.topic\}/);
  assert.match(component, /sausage-finger gloves/);
  assert.match(preferencesSource, /regulation-fill-blank-removals-v3/);
  assert.match(preferencesSource, /normalizeBlankRemovalIds/);
  assert.match(preferencesSource, /KNOWN_BLANK_IDS/);
  assert.match(bankBrowserSource, /navigator\.clipboard\.writeText/);
  assert.match(bankBrowserSource, /window\.addEventListener\("storage"/);
  assert.match(bankBrowserSource, /aria-pressed=\{isMarked\}/);
  assert.match(bankBrowserSource, /Copy removal list/);
  assert.match(styles, /\.blank-choice-grid/);
  assert.match(styles, /\.blank-restored-line/);
  assert.match(styles, /\.blank-review/);
  assert.match(styles, /\.blank-bank-card\.is-marked/);
  assert.match(styles, /\.blank-bank-options/);
});


test("server-renders the transcript-derived speaker timeline", async () => {
  const response = await render("/stats");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<title>Who Gets the Mic\? \| Regulation Who Said It<\/title>/i);
  assert.match(html, /who gets[\s\S]*the mic\?/i);
  assert.match(html, /Share of the conversation/i);
  assert.match(html, /Minutes on mic/i);
  assert.match(html, /First 100 vs latest 100/i);
  assert.match(html, /3\.2(?:<!-- -->)?%/i);
  assert.match(html, /21\.2(?:<!-- -->)?%/i);
  assert.match(html, /href="\/stats"[^>]*>Speaker stats/i);
});


test("server-renders the searchable, fully attributed 100-quote bank", async () => {
  const response = await render("/who-said-it/bank");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<title>Quote Bank \| Regulation Who Said It<\/title>/i);
  assert.match(html, /All <!-- -->100<!-- --> absurd lines/i);
  assert.match(html, /Search quotes, episodes, or context/i);
  assert.match(html, /Showing <strong>100<\/strong> of <!-- -->100<!-- --> quotes/i);
  assert.match(html, /every toilet on Earth was flushed/i);
  assert.match(html, /Icy Hot on your dick and balls/i);
  assert.match(html, /pickle paste is maybe 10 to 15 times better/i);
  assert.match(html, /dog doing a butt shimmy across all my stairs/i);
  assert.match(html, /the news would be on your waffle/i);
  assert.match(html, /href="\/"[^>]*>← Play without spoilers/i);
  assert.doesNotMatch(html, />Host quiz</i);
});


test("keeps the game balanced, varied, and transcript-grounded", async () => {
  const [whoSource, roundSource, bankBrowserSource, quoteBankText, profileText, design, layoutSource, styles] = await Promise.all([
    readFile(new URL("../app/WhoSaidItGame.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/who-said-it-round.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/WhoSaidItBankBrowser.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/data/who-said-it-bank.json", import.meta.url), "utf8"),
    readFile(new URL("../app/data/host-language-profiles.json", import.meta.url), "utf8"),
    readFile(new URL("../WHO_SAID_IT_DESIGN.md", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  const profiles = JSON.parse(profileText);
  const quoteBank = JSON.parse(quoteBankText);

  assert.equal(profiles.mappedEpisodes, 415);
  assert.equal(quoteBank.length, 100);
  assert.equal(new Set(quoteBank.map((item) => item.id)).size, 100);
  assert.equal(new Set(quoteBank.map((item) => item.quote)).size, 100);
  assert.equal(new Set(quoteBank.map((item) => item.episode)).size, 100);
  assert.deepEqual(
    quoteBank
      .filter((item) => Array.from(item.quote).length >= 200)
      .map((item) => ({ id: item.id, length: Array.from(item.quote).length })),
    [],
  );
  const hostNamePattern = /\b(?:geoff(?:rey)?|jeff|andrew|panton|gavin|gav|eric|ramsey|baudour)\b/i;
  assert.deepEqual(
    quoteBank.filter((item) => hostNamePattern.test(item.quote)).map((item) => item.id),
    [],
  );
  assert.deepEqual(
    Object.fromEntries(
      ["geoff", "andrew", "gavin", "eric"].map((host) => [
        host,
        quoteBank.filter((item) => item.speaker === host).length,
      ]),
    ),
    { geoff: 25, andrew: 25, gavin: 25, eric: 25 },
  );
  assert.deepEqual(
    Object.fromEntries(
      ["easy", "medium", "hard"].map((difficulty) => [
        difficulty,
        quoteBank.filter((item) => item.difficulty === difficulty).length,
      ]),
    ),
    { easy: 34, medium: 33, hard: 33 },
  );
  assert.deepEqual(
    {
      early: quoteBank.filter((item) => item.episode < 100).length,
      middle: quoteBank.filter((item) => item.episode >= 100 && item.episode <= 250).length,
      late: quoteBank.filter((item) => item.episode > 250).length,
    },
    { early: 35, middle: 36, late: 29 },
  );
  assert.ok(quoteBank.every((item) => item.startSec >= 0 && item.context && item.title));
  assert.ok(quoteBank.every((item) => (
    item.leadIn.length === 3
    && item.leadIn.every((line) => line.speaker && line.text && line.startSec < item.startSec)
  )));

  assert.match(whoSource, /WHO_SAID_IT_LENGTH/);
  assert.match(roundSource, /ROUND_DIFFICULTY_TARGETS/);
  assert.match(roundSource, /MIN_QUOTES_PER_HOST = 2/);
  assert.match(roundSource, /hostCounts\[host\] >= MIN_QUOTES_PER_HOST/);
  assert.match(roundSource, /deterministicFallback/);
  assert.match(whoSource, /pickRound\(new Set\(round\.map/);
  assert.match(whoSource, /window\.localStorage/);
  assert.doesNotMatch(whoSource, /navigator\.share|shareScore|Share score/);
  assert.match(whoSource, /handleShortcut/);
  assert.match(whoSource, /Where the accusations landed/);
  assert.match(whoSource, /Transcript excerpt \/ names restored/);
  assert.match(whoSource, /Three preceding transcript lines followed by the attributed mystery quote/);
  assert.match(whoSource, /className="wsi-transcript-quote"/);
  assert.match(whoSource, /<strong>{correctProfile\.name}<\/strong>/);
  assert.match(whoSource, /<p>{current\.quote}<\/p>/);
  assert.match(styles, /\.wsi-transcript-lead li\.wsi-transcript-quote/);
  assert.match(bankBrowserSource, /aria-pressed/);
  assert.match(design, /34 easy, 33 medium, and 33 hard/i);
  assert.match(layoutSource, /\/og\.png/);
  const finalComposition = styles.slice(styles.indexOf("Final full-bleed gray composition"));
  assert.ok(styles.indexOf("Final full-bleed gray composition") > styles.indexOf("Regulation Podcast brand pass"));
  assert.match(finalComposition, /\.quiz-shell\s*{[^}]*width:\s*100%[^}]*max-width:\s*none[^}]*margin:\s*0[^}]*padding:\s*0/s);
  assert.match(finalComposition, /\.quiz-topbar\s*{[^}]*background:\s*#dededb/s);
  assert.match(finalComposition, /\.wsi-intro-grid\s*{[^}]*width:\s*100%[^}]*margin:\s*0[^}]*background:\s*#b7b7b2/s);
  assert.match(finalComposition, /\.wsi-intro-content\s*{[^}]*max-width:\s*1440px[^}]*margin:\s*0 auto/s);
  assert.match(finalComposition, /\.regulation-lockup small\s*{[^}]*line-height:\s*1\.05[^}]*white-space:\s*nowrap/s);
  assert.match(finalComposition, /Viewport-filling desktop question stage/);
  assert.match(finalComposition, /\.wsi-playing-shell \.wsi-round\s*{[^}]*grid-template-rows:\s*auto clamp\(320px, 47vh, 480px\) auto minmax\(64px, 1fr\)[^}]*height:\s*100%/s);
  assert.match(finalComposition, /\.wsi-playing-shell \.wsi-quote-card blockquote\s*{[^}]*font-size:\s*clamp\(38px, 3\.5vw, 58px\)/s);
  assert.match(finalComposition, /\.wsi-playing-shell \.progress-labels\s*{[^}]*font-size:\s*12px/s);
  assert.match(finalComposition, /\.wsi-playing-shell \.wsi-choice\s*{[^}]*min-height:\s*118px/s);
  assert.match(finalComposition, /\.wsi-playing-shell \.wsi-choice strong\s*{[^}]*font-size:\s*24px/s);
  assert.match(finalComposition, /\.wsi-playing-shell \.wsi-choice small\s*{[^}]*font-size:\s*12px/s);
  assert.match(finalComposition, /\.wsi-playing-shell \.wsi-round-controls > span\s*{[^}]*font-size:\s*11px/s);
  assert.match(finalComposition, /Readable desktop results/);
  assert.match(finalComposition, /\.wsi-result-shell \.wsi-result-hero\s*{[^}]*grid-template-columns:\s*minmax\(0, 1\.2fr\) minmax\(560px, 0\.8fr\)/s);
  assert.match(finalComposition, /\.wsi-result-shell \.wsi-score-slip\s*{[^}]*max-width:\s*760px/s);
  assert.match(finalComposition, /\.wsi-result-shell \.wsi-score-slip > strong\s*{[^}]*font-size:\s*clamp\(106px, 7vw, 144px\)/s);
  assert.match(finalComposition, /\.wsi-result-shell \.wsi-breakdown-grid article > strong\s*{[^}]*display:\s*flex[^}]*gap:\s*6px[^}]*letter-spacing:\s*-0\.04em/s);
  assert.match(finalComposition, /\.wsi-result-shell \.wsi-review-list \.wsi-host-badge\s*{[^}]*font-size:\s*13px/s);

  await access(new URL("../public/og.png", import.meta.url));
  await access(new URL("../public/regulation-brand-mark.jpg", import.meta.url));
  await assert.rejects(access(new URL("../app/_sites-preview", import.meta.url)));
});

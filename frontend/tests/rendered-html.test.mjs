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
  assert.match(html, /<dt>Quote bank<\/dt><dd>60<\/dd>/i);
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
  assert.match(html, /All <!-- -->60<!-- --> absurd lines/i);
  assert.match(html, /Search quotes, episodes, or context/i);
  assert.doesNotMatch(html, /All <!-- -->39<!-- --> bad decisions|host-by-host question bank/i);
});


test("server-renders the dedicated Who Said It route", async () => {
  const response = await render("/who-said-it");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<title>Regulation Who Said It<\/title>/i);
  assert.match(html, /Made by community member Michael Booth/i);
  assert.match(html, /<dt>Quote bank<\/dt><dd>60<\/dd>/i);
  assert.match(html, /<dt>Rounds served<\/dt><dd>10<\/dd>/i);
  assert.match(html, /I have a 50-foot ham tower/i);
});


test("server-renders the searchable, fully attributed 60-quote bank", async () => {
  const response = await render("/who-said-it/bank");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<title>Quote Bank \| Regulation Who Said It<\/title>/i);
  assert.match(html, /All <!-- -->60<!-- --> absurd lines/i);
  assert.match(html, /Search quotes, episodes, or context/i);
  assert.match(html, /Showing <strong>60<\/strong> of <!-- -->60<!-- --> quotes/i);
  assert.match(html, /every toilet on Earth was flushed/i);
  assert.match(html, /Icy Hot on your dick and balls/i);
  assert.match(html, /pickle paste is maybe 10 to 15 times better/i);
  assert.match(html, /href="\/"[^>]*>← Play without spoilers/i);
  assert.doesNotMatch(html, />Host quiz</i);
});


test("keeps the game balanced, varied, and transcript-grounded", async () => {
  const [whoSource, bankBrowserSource, quoteBankText, profileText, design, layoutSource, styles] = await Promise.all([
    readFile(new URL("../app/WhoSaidItGame.tsx", import.meta.url), "utf8"),
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
  assert.equal(quoteBank.length, 60);
  assert.equal(new Set(quoteBank.map((item) => item.id)).size, 60);
  assert.equal(new Set(quoteBank.map((item) => item.quote)).size, 60);
  assert.equal(new Set(quoteBank.map((item) => item.episode)).size, 60);
  assert.deepEqual(
    Object.fromEntries(
      ["geoff", "andrew", "gavin", "eric"].map((host) => [
        host,
        quoteBank.filter((item) => item.speaker === host).length,
      ]),
    ),
    { geoff: 15, andrew: 15, gavin: 15, eric: 15 },
  );
  assert.deepEqual(
    Object.fromEntries(
      ["easy", "medium", "hard"].map((difficulty) => [
        difficulty,
        quoteBank.filter((item) => item.difficulty === difficulty).length,
      ]),
    ),
    { easy: 20, medium: 20, hard: 20 },
  );
  assert.ok(quoteBank.every((item) => item.startSec >= 0 && item.context && item.title));
  assert.ok(quoteBank.every((item) => (
    item.leadIn.length === 3
    && item.leadIn.every((line) => line.speaker && line.text && line.startSec < item.startSec)
  )));

  assert.match(whoSource, /WHO_SAID_IT_LENGTH/);
  assert.match(whoSource, /ROUND_DIFFICULTY_TARGETS/);
  assert.match(whoSource, /hostCounts\[host\] >= 2/);
  assert.match(whoSource, /pickRound\(new Set\(round\.map/);
  assert.match(whoSource, /window\.localStorage/);
  assert.match(whoSource, /navigator\.share/);
  assert.match(whoSource, /handleShortcut/);
  assert.match(whoSource, /Where the accusations landed/);
  assert.match(whoSource, /Transcript lead-in \/ names restored/);
  assert.match(whoSource, /Conversation immediately before the mystery quote/);
  assert.match(bankBrowserSource, /aria-pressed/);
  assert.match(design, /20 easy, 20 medium, and 20 hard/i);
  assert.match(layoutSource, /\/og\.png/);
  const finalComposition = styles.slice(styles.indexOf("Final full-bleed gray composition"));
  assert.ok(styles.indexOf("Final full-bleed gray composition") > styles.indexOf("Regulation Podcast brand pass"));
  assert.match(finalComposition, /\.quiz-shell\s*{[^}]*width:\s*100%[^}]*max-width:\s*none[^}]*margin:\s*0[^}]*padding:\s*0/s);
  assert.match(finalComposition, /\.quiz-topbar\s*{[^}]*background:\s*#dededb/s);
  assert.match(finalComposition, /\.wsi-intro-grid\s*{[^}]*width:\s*100%[^}]*margin:\s*0[^}]*background:\s*#b7b7b2/s);
  assert.match(finalComposition, /\.wsi-intro-content\s*{[^}]*max-width:\s*1440px[^}]*margin:\s*0 auto/s);
  assert.match(finalComposition, /\.regulation-lockup small\s*{[^}]*line-height:\s*1\.05[^}]*white-space:\s*nowrap/s);
  assert.match(finalComposition, /Viewport-filling desktop question stage/);
  assert.match(finalComposition, /\.wsi-playing-shell \.wsi-round\s*{[^}]*grid-template-rows:\s*auto minmax\(320px, 1fr\) auto auto[^}]*height:\s*100%/s);
  assert.match(finalComposition, /\.wsi-playing-shell \.wsi-quote-card blockquote\s*{[^}]*font-size:\s*clamp\(34px, 3\.25vw, 54px\)/s);
  assert.match(finalComposition, /\.wsi-playing-shell \.progress-labels\s*{[^}]*font-size:\s*12px/s);
  assert.match(finalComposition, /\.wsi-playing-shell \.wsi-choice\s*{[^}]*min-height:\s*112px/s);
  assert.match(finalComposition, /\.wsi-playing-shell \.wsi-round-controls > span\s*{[^}]*font-size:\s*11px/s);

  await access(new URL("../public/og.png", import.meta.url));
  await access(new URL("../public/regulation-brand-mark.jpg", import.meta.url));
  await assert.rejects(access(new URL("../app/_sites-preview", import.meta.url)));
});

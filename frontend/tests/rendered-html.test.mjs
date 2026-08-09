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


test("server-renders the Regulation Quiz intro", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Which Regulation Host Are You\? \| Regulation Quiz<\/title>/i);
  assert.match(html, /Scientifically unnecessary/i);
  assert.match(html, /Which mic/i);
  assert.match(html, /Ten bad decisions/i);
  assert.match(html, /Begin the investigation/i);
  assert.match(html, /415<!-- --> episodes digested/i);
  assert.match(html, /Question bank<\/dt><dd>39<\/dd>/i);
  assert.match(html, /href="\/questions"[^>]*>Question bank/i);
  for (const host of ["Geoff", "Andrew", "Gavin", "Eric"]) {
    assert.match(html, new RegExp(`<strong>${host}</strong>`));
  }
  assert.doesNotMatch(html, /The talk table|Building your site|react-loading-skeleton/i);
});


test("server-renders the searchable host-by-host question bank", async () => {
  const response = await render("/questions");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Question Bank \| Regulation Quiz<\/title>/i);
  assert.match(html, /All <!-- -->39<!-- --> bad decisions/i);
  assert.match(html, /Search prompts, answers, or traits/i);
  assert.match(html, /Showing <strong>39<\/strong> of <!-- -->39<!-- --> questions/i);
  assert.match(html, /A kitchen appliance makes a wet noise/i);
  for (const host of ["Geoff", "Andrew", "Gavin", "Eric"]) {
    assert.match(html, new RegExp(`aria-label="${host} answer"`));
  }
  assert.match(html, /You transformed a household malfunction into material/i);
  assert.match(html, /href="\/"[^>]*>← Take the quiz/i);
});


test("server-renders the transcript-based Who Said It game", async () => {
  const response = await render("/who-said-it");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Who Said It\? \| Regulation Games<\/title>/i);
  assert.match(html, /Out of context \/ under oath/i);
  assert.match(html, /Ten real lines\. Four possible hosts/i);
  assert.match(html, /Open the transcript file/i);
  assert.match(html, /<dt>Quote bank<\/dt><dd>30<\/dd>/i);
  assert.match(html, /<dt>Rounds served<\/dt><dd>10<\/dd>/i);
  assert.match(html, /I have a 50-foot ham tower/i);
  assert.match(html, /href="\/who-said-it\/bank"[^>]*>Quote bank/i);
  for (const host of ["Geoff", "Andrew", "Gavin", "Eric"]) {
    assert.match(html, new RegExp(host));
  }
});


test("server-renders a searchable, fully attributed quote bank", async () => {
  const response = await render("/who-said-it/bank");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Who Said It Quote Bank \| Regulation Games<\/title>/i);
  assert.match(html, /All <!-- -->30<!-- --> absurd lines/i);
  assert.match(html, /Search quotes, episodes, or context/i);
  assert.match(html, /Showing <strong>30<\/strong> of <!-- -->30<!-- --> quotes/i);
  assert.match(html, /every toilet on Earth was flushed/i);
  assert.match(html, /Icy Hot on your dick and balls/i);
  assert.match(html, /Relax, This Is a Robbery/i);
  assert.match(html, /href="\/who-said-it"[^>]*>← Play without spoilers/i);
});


test("keeps a balanced, transcript-grounded question bank", async () => {
  const [quizSource, browserSource, bankSource, profileText, design, whoSource, quoteBankText] = await Promise.all([
    readFile(new URL("../app/QuizApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/QuestionBankBrowser.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/quiz-data.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/data/host-language-profiles.json", import.meta.url), "utf8"),
    readFile(new URL("../QUIZ_DESIGN.md", import.meta.url), "utf8"),
    readFile(new URL("../app/WhoSaidItGame.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/data/who-said-it-bank.json", import.meta.url), "utf8"),
  ]);
  const profiles = JSON.parse(profileText);
  const quoteBank = JSON.parse(quoteBankText);
  const categories = [...bankSource.matchAll(/category: "([^"]+)"/g)].map((match) => match[1]);
  const categoryCounts = new Map();
  for (const category of categories) {
    categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1);
  }

  assert.equal(categories.length, 39);
  assert.equal(categoryCounts.size, 13);
  assert.ok([...categoryCounts.values()].every((count) => count === 3));
  assert.equal((bankSource.match(/\sanswer\("/g) ?? []).length, categories.length * 4);
  for (const ingredient of ["bean hole", "pencil", "bog", "sausage", "Cosmic Crisp", "fireplace"]) {
    assert.match(bankSource, new RegExp(ingredient, "i"));
  }

  assert.match(quizSource, /const QUIZ_LENGTH = 10/);
  assert.match(quizSource, /slice\(0, QUIZ_LENGTH\)/);
  assert.match(quizSource, /Evidence from your answers/);
  assert.match(quizSource, /option\.insight/);
  assert.match(browserSource, /primaryAnswer/);
  assert.match(browserSource, /setCategory/);
  assert.match(browserSource, /setQuery/);
  assert.match(browserSource, /HOST_ORDER\.map/);
  assert.match(design, /not a psychological assessment/i);

  assert.equal(profiles.mappedEpisodes, 415);
  assert.deepEqual(Object.keys(profiles.profiles), ["Geoff", "Andrew", "Gavin", "Eric"]);
  assert.ok(profiles.profiles.Geoff.turnWordsMean > profiles.profiles.Gavin.turnWordsMean);
  assert.ok(
    profiles.profiles.Gavin.questionSegmentsPerThousand >
      profiles.profiles.Andrew.questionSegmentsPerThousand,
  );
  assert.ok(
    profiles.profiles.Andrew.markersPerThousandWords.firstPerson >
      profiles.profiles.Geoff.markersPerThousandWords.firstPerson,
  );
  assert.ok(
    profiles.profiles.Eric.markersPerThousandWords.controlLanguage >
      profiles.profiles.Geoff.markersPerThousandWords.controlLanguage,
  );

  assert.equal(quoteBank.length, 30);
  assert.equal(new Set(quoteBank.map((item) => item.id)).size, 30);
  assert.equal(new Set(quoteBank.map((item) => item.quote)).size, 30);
  assert.equal(new Set(quoteBank.map((item) => item.episode)).size, 30);
  assert.deepEqual(
    Object.fromEntries(
      ["geoff", "andrew", "gavin", "eric"].map((host) => [
        host,
        quoteBank.filter((item) => item.speaker === host).length,
      ]),
    ),
    { geoff: 8, andrew: 8, gavin: 7, eric: 7 },
  );
  assert.ok(quoteBank.every((item) => ["easy", "medium", "hard"].includes(item.difficulty)));
  assert.ok(quoteBank.every((item) => item.startSec >= 0 && item.context && item.title));
  assert.match(whoSource, /WHO_SAID_IT_LENGTH/);
  assert.match(whoSource, /slice\(0, 2\)/);
  assert.match(whoSource, /It was \{correctProfile\.name\}/);
  assert.match(whoSource, /Draw ten new quotes/);

  await access(new URL("../public/og.png", import.meta.url));
  await assert.rejects(access(new URL("../app/_sites-preview", import.meta.url)));
});

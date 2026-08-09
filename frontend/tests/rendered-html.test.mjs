import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";


async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
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
  for (const host of ["Geoff", "Andrew", "Gavin", "Eric"]) {
    assert.match(html, new RegExp(`<strong>${host}</strong>`));
  }
  assert.doesNotMatch(html, /The talk table|Building your site|react-loading-skeleton/i);
});


test("keeps a balanced, transcript-grounded question bank", async () => {
  const [quizSource, bankSource, profileText, design] = await Promise.all([
    readFile(new URL("../app/QuizApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/quiz-data.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/data/host-language-profiles.json", import.meta.url), "utf8"),
    readFile(new URL("../QUIZ_DESIGN.md", import.meta.url), "utf8"),
  ]);
  const profiles = JSON.parse(profileText);
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

  await access(new URL("../public/og.png", import.meta.url));
  await assert.rejects(access(new URL("../app/_sites-preview", import.meta.url)));
});

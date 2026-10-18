import assert from "node:assert/strict";
import test from "node:test";
import {
  compactGuess,
  judgeGuess,
  normalizeGuess,
  typoBudget,
  weightedDistance,
} from "../app/fill-blank-match.ts";


test("normalises case, accents, punctuation, and one leading article", () => {
  assert.equal(normalizeGuess("  The   FAN "), "fan");
  assert.equal(normalizeGuess("Pokémon"), "pokemon");
  assert.equal(normalizeGuess("somebody’s pie"), "somebodys pie");
  assert.equal(normalizeGuess("port-a-potty"), "port a potty");
  assert.equal(normalizeGuess("a harder burger"), "harder burger");
  assert.equal(normalizeGuess("an the"), "the");
  assert.equal(compactGuess("Porta Potty!"), "portapotty");
});


test("weights substitutions by keyboard distance and vowels", () => {
  assert.equal(weightedDistance("milk", "milk"), 0);
  assert.equal(weightedDistance("mlik", "milk"), 1);
  assert.equal(weightedDistance("mink", "milk"), 2);
  assert.equal(weightedDistance("beams", "beans"), 1);
  assert.equal(weightedDistance("bears", "beans"), 2);
  assert.equal(weightedDistance("serkus", "serkis"), 1);
  assert.equal(weightedDistance("bowl", "bowel"), 1);
  assert.equal(weightedDistance("grave", "gravy"), 2);
  assert.deepEqual([3, 4, 5, 6, 9, 10].map((n) => typoBudget("x".repeat(n))), [0, 1, 1, 2, 2, 3]);
});


const cases = [
  // [guess, target, verdict, reason]
  ["Alexa", { answer: "Alexa" }, "exact", "exact"],
  ["ALEXA", { answer: "Alexa" }, "exact", "exact"],
  ["fan", { answer: "the fan" }, "exact", "exact"],
  ["a fan", { answer: "the fan" }, "exact", "exact"],
  ["porta potty", { answer: "port-a-potty" }, "exact", "exact"],
  ["portapotty", { answer: "port-a-potty" }, "exact", "exact"],
  ["porta-potti", { answer: "port-a-potty" }, "accepted", "typo"],
  ["ipad", { answer: "iPad" }, "exact", "exact"],
  ["steal somebodys pie", { answer: "steal somebody's pie" }, "exact", "exact"],
  ["shower curtain", { answer: "shower curtains" }, "accepted", "plural"],
  ["egg", { answer: "eggs" }, "accepted", "plural"],
  ["Serkis", { answer: "Andy Serkis", accept: ["Serkis"] }, "accepted", "alias"],
  ["serkus", { answer: "Andy Serkis", accept: ["Serkis"] }, "accepted", "typo"],
  ["Andy Sirkis", { answer: "Andy Serkis" }, "accepted", "typo"],
  ["wafle iron", { answer: "waffle iron" }, "accepted", "typo"],
  ["mlik", { answer: "milk" }, "accepted", "typo"],
  ["beams", { answer: "beans" }, "accepted", "typo"],
  ["bowl", { answer: "bowel" }, "accepted", "typo"],
  ["mink", { answer: "milk" }, "near", "near"],
  ["grave", { answer: "gravy" }, "near", "near"],
  ["bears", { answer: "beans" }, "near", "near"],
  ["bet", { answer: "bat" }, "near", "near"],
  ["silk", { answer: "milk" }, "wrong", "wrong"],
  ["custard", { answer: "gravy" }, "wrong", "wrong"],
  ["iflk", { answer: "milk" }, "wrong", "wrong"],
  ["lmik", { answer: "milk" }, "wrong", "wrong"],
  ["imlk", { answer: "milk" }, "accepted", "typo"],
  ["bowl", { answer: "bowel", reject: ["bowl"] }, "wrong", "rejected"],
  ["bowls", { answer: "bowel", reject: ["bowl"] }, "wrong", "rejected"],
  ["bowel", { answer: "bowel", reject: ["bowl"] }, "exact", "exact"],
  ["   ", { answer: "milk" }, "empty", "empty"],
  ["!!", { answer: "milk" }, "empty", "empty"],
  ["switch", { answer: "Nintendo Switch", accept: ["Switch"] }, "accepted", "alias"],
  ["swtich", { answer: "Nintendo Switch", accept: ["Switch"] }, "accepted", "typo"],
  ["nintendo", { answer: "Nintendo Switch", accept: ["Switch"] }, "wrong", "wrong"],
  ["in circle", { answer: "in a circle" }, "accepted", "typo"],
  ["ina circle", { answer: "in a circle" }, "exact", "exact"],
  ["Anthony Bourdain", { answer: "Anthony Bourdain" }, "exact", "exact"],
  ["anthony bordain", { answer: "Anthony Bourdain" }, "accepted", "typo"],
];

for (const [guess, target, verdict, reason] of cases) {
  test(`judges ${JSON.stringify(guess)} against ${JSON.stringify(target.answer)} as ${verdict}`, () => {
    const result = judgeGuess(guess, target);
    assert.equal(result.verdict, verdict);
    assert.equal(result.reason, reason);
  });
}

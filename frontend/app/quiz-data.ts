export type HostId = "geoff" | "andrew" | "gavin" | "eric";

export type QuizOption = {
  id: string;
  label: string;
  scores: Partial<Record<HostId, number>>;
  trait: string;
  insight: string;
};

export type QuizQuestion = {
  id: string;
  category: string;
  prompt: string;
  options: QuizOption[];
};

export type HostProfile = {
  id: HostId;
  name: string;
  title: string;
  shortTitle: string;
  description: string;
  dataSignal: string;
  color: string;
  pale: string;
};

export const HOST_ORDER: HostId[] = ["geoff", "andrew", "gavin", "eric"];

export const HOST_PROFILES: Record<HostId, HostProfile> = {
  geoff: {
    id: "geoff",
    name: "Geoff",
    title: "The Story-First Instigator",
    shortTitle: "Story instinct",
    description:
      "You turn ordinary life into lore. A bad errand becomes a three-act saga, a sentimental detail survives every tangent, and committing to the bit is usually more important than arriving efficiently.",
    dataSignal:
      "In the mapped archive, Geoff has the longest average turns of the four and the lowest question rate—the linguistic shape of someone building the story before handing over the mic.",
    color: "#ff6038",
    pale: "#ffd4c7",
  },
  andrew: {
    id: "andrew",
    name: "Andrew",
    title: "The Scenario Architect",
    shortTitle: "Scenario logic",
    description:
      "You can find a premise inside anything and a loophole inside the premise. You are specific, gloriously committed, and capable of turning one tiny disagreement into a complete alternate legal system.",
    dataSignal:
      "Andrew leads the group in first-person framing and negation, while words such as “scenario,” “premise,” “context,” and “category” are unusually distinctive in his transcript profile.",
    color: "#ffd338",
    pale: "#fff0a6",
  },
  gavin: {
    id: "gavin",
    name: "Gavin",
    title: "The Curiosity Engine",
    shortTitle: "Curiosity drive",
    description:
      "Your brain spots the one unexplained corner everyone else walked past. You ask the dangerous follow-up, test the physical reality, and introduce just enough skepticism to make a simple plan beautifully strange.",
    dataSignal:
      "Gavin asks questions roughly 38% more often than the next-highest host and has the fastest measured speaking pace, with unusually frequent language around whether something could or might work.",
    color: "#58d8ff",
    pale: "#c9f3ff",
  },
  eric: {
    id: "eric",
    name: "Eric",
    title: "The Reality Referee",
    shortTitle: "Reality control",
    description:
      "You hear the wheels coming off before anyone else and—crucially—you say so. You bring structure, decisive reactions, and the exact amount of disbelief required to keep chaos entertaining instead of merely expensive.",
    dataSignal:
      "Eric has the shortest average turns, the most agreement and intensifier language, and the highest use of “we” framing—compact signals from the person keeping the room moving together.",
    color: "#a98cff",
    pale: "#ded1ff",
  },
};

function answer(
  id: string,
  label: string,
  host: HostId,
  trait: string,
  insight: string,
  secondary?: HostId,
): QuizOption {
  return {
    id,
    label,
    scores: secondary ? { [host]: 3, [secondary]: 1 } : { [host]: 3 },
    trait,
    insight,
  };
}

export const QUESTION_BANK: QuizQuestion[] = [
  {
    id: "crisis-kitchen",
    category: "Minor crisis",
    prompt: "A kitchen appliance makes a wet noise, then reveals a bean-sized hole underneath it. What happens next?",
    options: [
      answer("g", "I tell everyone the appliance’s entire emotional backstory.", "geoff", "story instinct", "You transformed a household malfunction into material."),
      answer("e", "Unplug it. We are not dying for a countertop gadget.", "eric", "decisive triage", "You protected the group by ending the bad idea immediately."),
      answer("v", "I make the noise happen again, but scientifically this time.", "gavin", "experimental curiosity", "You preferred one risky test to living with an unanswered question."),
      answer("a", "First, we need to establish what counts as a normal appliance noise.", "andrew", "premise building", "You refused to proceed until the terms of the crisis were airtight."),
    ],
  },
  {
    id: "crisis-hotel",
    category: "Minor crisis",
    prompt: "The hotel has lost your reservation and your suitcase contains 400 ceremonial pencils. Your first move?",
    options: [
      answer("a", "Produce the confirmation email and begin a calm, devastating case.", "andrew", "evidence stack", "You met administrative chaos with a fully documented argument."),
      answer("g", "Accept this as chapter one of the trip’s defining story.", "geoff", "lore conversion", "You recognized a future favorite story while it was still ruining your evening."),
      answer("e", "Find the person who can fix it and skip the ceremonial helplessness.", "eric", "operational focus", "You looked past the performance and found the actual decision-maker."),
      answer("v", "Ask how a reservation can exist in my phone but not in the building.", "gavin", "system curiosity", "You became fascinated by the impossible gap between two systems."),
    ],
  },
  {
    id: "story-embarrassment",
    category: "Storytelling",
    prompt: "You tried to measure a public bathtub with your forearm and got stuck. How do your friends hear about it?",
    options: [
      answer("e", "In one brutal sentence, with the lesson clearly labeled.", "eric", "compressed honesty", "You valued the clean hit over ornamental detail."),
      answer("v", "I focus on the one physical detail that makes no sense.", "gavin", "odd-detail focus", "You found the tiny unexplained mechanism inside the larger disaster."),
      answer("g", "From the beginning. The weather and my outfit are important.", "geoff", "narrative texture", "You knew the surrounding details were part of the entertainment."),
      answer("a", "Only after clarifying why every choice was reasonable at the time.", "andrew", "context defense", "You constructed the exact context required to make your actions defensible."),
    ],
  },
  {
    id: "story-late-friend",
    category: "Storytelling",
    prompt: "A friend arrives 40 minutes late in a tuxedo, carrying one warm hot dog and no explanation. You…",
    options: [
      answer("v", "Interrupt twice because the timeline violates physics.", "gavin", "timeline testing", "You tested the story at the precise points where reality buckled."),
      answer("a", "Argue that the excuse is plausible under one very specific reading.", "andrew", "edge-case defense", "You discovered the narrow interpretation that could save the premise."),
      answer("g", "Save every detail because this story is now community property.", "geoff", "story stewardship", "You treated a friend’s failure as valuable shared folklore."),
      answer("e", "Say, “That’s crazy,” and ask whether we are leaving or not.", "eric", "forward motion", "You delivered the reaction and kept the day from dying there."),
    ],
  },
  {
    id: "rules-board-game",
    category: "Rules & loopholes",
    prompt: "A ceremonial draft requires everyone to pick a sandwich, but “sandwich” was never defined. You…",
    options: [
      answer("a", "The wording is the game now. I will be presenting exhibits.", "andrew", "rule litigation", "You found a second, richer game inside the disputed wording."),
      answer("e", "We choose a ruling in 30 seconds and live with it.", "eric", "house authority", "You chose a usable ruling over a perfect evening-ending debate."),
      answer("g", "Whichever interpretation creates the better story.", "geoff", "narrative rules", "You judged the rule by the quality of the memory it would create."),
      answer("v", "I test both interpretations with the pieces before voting.", "gavin", "physical proof", "You wanted to see the rule operate before trusting anyone’s theory."),
    ],
  },
  {
    id: "rules-household",
    category: "Rules & loopholes",
    prompt: "Your household creates one rule for what counts as a regulation sandwich. Within a week you have…",
    options: [
      answer("g", "Broken it for a reason that became an excellent anecdote.", "geoff", "productive chaos", "You accepted a small rule violation as the price of a much better story."),
      answer("v", "Discovered the rule creates a completely different problem.", "gavin", "unintended consequences", "You spotted the mechanical side effect no one modeled."),
      answer("e", "Put the rule somewhere visible because apparently that was necessary.", "eric", "practical enforcement", "You converted a vague agreement into something the group could actually follow."),
      answer("a", "Found an exception so precise it deserves its own subsection.", "andrew", "loophole craft", "You respected the rule enough to locate its most elegant exception."),
    ],
  },
  {
    id: "curiosity-button",
    category: "Curiosity",
    prompt: "There is an unlabeled button beside a suspiciously full bathtub in a rented house. Be honest.",
    options: [
      answer("v", "Press it while watching every light, vent, and neighbor.", "gavin", "live experiment", "You could not leave an observable mystery unobserved."),
      answer("e", "Do not press mystery infrastructure in somebody else’s house.", "eric", "risk boundary", "You supplied the sentence everyone needed before property damage occurred."),
      answer("a", "Map every possible outcome, then press it for closure.", "andrew", "scenario tree", "You built a complete possibility space and still honored the premise."),
      answer("g", "Press it, then tell the story as though fate selected me.", "geoff", "destiny framing", "You turned a voluntary decision into a tale of inevitable adventure."),
    ],
  },
  {
    id: "curiosity-animal",
    category: "Curiosity",
    prompt: "A squirrel runs past carrying an intact pencil and half a sausage. Your priority is…",
    options: [
      answer("e", "Keep walking. We have an appointment.", "eric", "mission protection", "You refused to let wildlife rewrite the day’s agenda."),
      answer("g", "Give the squirrel a name and explain its troubled marriage.", "geoff", "instant mythology", "You supplied a life story before the squirrel crossed the pavement."),
      answer("v", "Work out what it is carrying and how it picked it up.", "gavin", "mechanical curiosity", "You pursued the unanswered how before accepting the scene."),
      answer("a", "Decide whether the object legally belongs to the squirrel now.", "andrew", "conceptual jurisdiction", "You found the philosophical dispute hiding in a tiny animal encounter."),
    ],
  },
  {
    id: "food-menu",
    category: "Food decisions",
    prompt: "The menu contains a “regulation sandwich” with one legally troubling ingredient. You order…",
    options: [
      answer("g", "The dare. Even failure has narrative value.", "geoff", "experience collecting", "You ordered for the memory, not merely the meal."),
      answer("a", "A customized version that technically still counts as the item.", "andrew", "specification control", "You negotiated a version that satisfied both appetite and definition."),
      answer("e", "The proven good thing. Hunger is not a laboratory.", "eric", "quality control", "You protected a real meal from becoming unnecessary content."),
      answer("v", "The dare, but mainly to understand the texture.", "gavin", "sensory investigation", "You accepted culinary danger in exchange for new physical information."),
    ],
  },
  {
    id: "food-ranking",
    category: "Food decisions",
    prompt: "Friends demand a definitive ranking of five apples, including one alarmingly confident Cosmic Crisp. You…",
    options: [
      answer("e", "Create the categories, collect the votes, announce the winner.", "eric", "format control", "You gave the debate enough structure to reach an ending."),
      answer("v", "Question whether crunch and flavor can share one ranking.", "gavin", "measurement skepticism", "You challenged the hidden assumption inside a supposedly simple scale."),
      answer("a", "Reveal that my number one depends on the snack’s temperature.", "andrew", "conditional ranking", "You made the ranking accurate by introducing the variable everyone ignored."),
      answer("g", "Rank them by the memories attached to each one.", "geoff", "sentimental metric", "You let personal history outrank laboratory objectivity."),
    ],
  },
  {
    id: "tech-update",
    category: "Technology",
    prompt: "A bathroom app update moves the “drain tub” button directly beside “fill tub.” Your response?",
    options: [
      answer("a", "Document why the old location was objectively more coherent.", "andrew", "system argument", "You prepared a principled case against arbitrary interface law."),
      answer("g", "Tell a story about the last update that betrayed me.", "geoff", "grievance lore", "You connected fresh technological pain to an established personal canon."),
      answer("v", "Try to learn whether the new spot is faster after three days.", "gavin", "fair testing", "You gave the strange design a measurable chance to prove itself."),
      answer("e", "Complain once, relearn it, move on with my life.", "eric", "adaptation speed", "You budgeted exactly one reaction before resuming normal operations."),
    ],
  },
  {
    id: "tech-invention",
    category: "Technology",
    prompt: "You can invent one extremely specific machine for the Regulation Office. It solves…",
    options: [
      answer("v", "A tiny physical annoyance no one else has noticed yet.", "gavin", "micro engineering", "You targeted the overlooked mechanical friction in ordinary life."),
      answer("g", "A problem created by one of my previous adventures.", "geoff", "lore engineering", "Your invention arrived as the sequel to an existing story."),
      answer("e", "The group’s repeated failure to do one simple task correctly.", "eric", "process repair", "You automated the frustration that should never have required repeating."),
      answer("a", "A problem that only exists under a fascinating set of conditions.", "andrew", "beautiful specificity", "You designed for the scenario’s elegance rather than market size."),
    ],
  },
  {
    id: "competition-trivia",
    category: "Competition",
    prompt: "You are losing trivia after “Does a dog know it is a dog?” was ruled objective fact. You…",
    options: [
      answer("e", "Make one appeal, accept the ruling, keep the game alive.", "eric", "competitive governance", "You defended fairness without sacrificing the format."),
      answer("a", "Return to the exact wording. This point is absolutely recoverable.", "andrew", "semantic appeal", "You knew the disputed point still lived inside the sentence."),
      answer("v", "Check the source because now I genuinely need to know.", "gavin", "truth seeking", "You cared about the underlying fact even after the scoreboard moved on."),
      answer("g", "Lose loudly enough that the injustice becomes the night’s best story.", "geoff", "theatrical loss", "You converted a lost point into a win for the room."),
    ],
  },
  {
    id: "competition-bet",
    category: "Competition",
    prompt: "A harmless horse-related bet is proposed, then immediately becomes administrative. You join if…",
    options: [
      answer("v", "The outcome can be tested in a satisfyingly physical way.", "gavin", "testable stakes", "You wanted the universe to provide a clean answer."),
      answer("g", "The punishment will be funny even if I lose.", "geoff", "story-positive risk", "You judged the downside by whether it would entertain future you."),
      answer("a", "The terms contain enough complexity to reward preparation.", "andrew", "strategic premise", "You were drawn to the hidden game inside the bet’s conditions."),
      answer("e", "Everybody agrees on the rules before anyone starts improvising.", "eric", "rule clarity", "You prevented tomorrow’s argument during today’s setup."),
    ],
  },
  {
    id: "social-party",
    category: "Social energy",
    prompt: "You attend a formal party inside a nearly closed mall. You gravitate toward…",
    options: [
      answer("g", "The person with one incredible story and time to tell it.", "geoff", "story magnetism", "You located the human source of the room’s best lore."),
      answer("e", "The host, because something clearly needs doing.", "eric", "useful presence", "You entered the social system by making it function better."),
      answer("a", "One person willing to discuss a bizarrely specific topic for an hour.", "andrew", "deep specificity", "You preferred one committed conversational universe to broad mingling."),
      answer("v", "Whatever object in the room requires an explanation.", "gavin", "environmental curiosity", "You let the room’s strangest artifact start the conversation."),
    ],
  },
  {
    id: "social-chat",
    category: "Social energy",
    prompt: "The group chat contains 94 messages, a pencil photo, and the words “bean hole emergency.” You…",
    options: [
      answer("a", "Reply to the oldest unresolved point because it still matters.", "andrew", "thread persistence", "You refused to let chronology erase an unfinished argument."),
      answer("v", "Ask one clarifying question that somehow creates five more.", "gavin", "question cascade", "You improved understanding and complexity at the same time."),
      answer("e", "Summarize the decision and tell everyone what is happening.", "eric", "group alignment", "You turned conversational debris back into a usable plan."),
      answer("g", "Add the perfect personal anecdote and make it even longer.", "geoff", "productive tangent", "You chose enrichment over containment."),
    ],
  },
  {
    id: "planning-trip",
    category: "Planning",
    prompt: "Four friends plan a weekend trip built around one mall, one bathtub, and a sausage appointment. Your document contains…",
    options: [
      answer("e", "Times, addresses, reservations, and one owner per task.", "eric", "operational planning", "You built the version of the plan that can survive contact with people."),
      answer("g", "One anchor activity and generous room for a story to happen.", "geoff", "planned spontaneity", "You protected the possibility of an unplanned favorite memory."),
      answer("v", "Transit times and answers to oddly practical local questions.", "gavin", "friction mapping", "You investigated the physical details that decide whether a plan works."),
      answer("a", "Several branches depending on weather, energy, and snack access.", "andrew", "scenario planning", "You prepared the correct weekend for every plausible universe."),
    ],
  },
  {
    id: "planning-project",
    category: "Planning",
    prompt: "A fun side project involving a miniature blimp is getting suspiciously complicated. You…",
    options: [
      answer("v", "Prototype the strangest part before deciding it is possible.", "gavin", "prototype instinct", "You tested the uncertain mechanism before polishing the idea."),
      answer("a", "Expand the document. The complexity means we are getting somewhere.", "andrew", "system expansion", "You interpreted new edge cases as evidence of a richer premise."),
      answer("g", "Keep the ambitious version; the struggle is part of its charm.", "geoff", "commitment to the bit", "You protected the version most likely to create a legendary process."),
      answer("e", "Cut two features and give the surviving idea a deadline.", "eric", "scope control", "You rescued the project by making completion real again."),
    ],
  },
  {
    id: "disagreement-fact",
    category: "Disagreement",
    prompt: "A friend confidently claims any hole containing one bean is legally a bean hole. You…",
    options: [
      answer("g", "Counter with a personal story that may or may not settle anything.", "geoff", "experiential rebuttal", "You trusted lived evidence to complicate the clean claim."),
      answer("v", "Ask how they know, then look it up together.", "gavin", "skeptical inquiry", "You used a question to turn certainty back into investigation."),
      answer("e", "Correct it if it matters; let it go if it does not.", "eric", "stakes awareness", "You matched the amount of debate to the consequence."),
      answer("a", "Identify the narrow definition under which we might both be right.", "andrew", "definition repair", "You preserved both positions by rebuilding the category."),
    ],
  },
  {
    id: "disagreement-movie",
    category: "Disagreement",
    prompt: "Everyone declares one random movie the official winner of the Summer of ’98. Your dissent begins…",
    options: [
      answer("a", "“I understand the intent, but the premise creates a problem…”", "andrew", "premise critique", "You challenged the movie by following its own internal logic."),
      answer("e", "“It’s fine. I do not understand what we are doing here.”", "eric", "clean dissent", "You delivered a decisive temperature check without inventing homework."),
      answer("v", "“Why did that one object behave like that?”", "gavin", "mechanical critique", "You found the concrete inconsistency inside the general acclaim."),
      answer("g", "“Here’s where I was in life when I watched it…”", "geoff", "personal frame", "You made the review inseparable from the life around it."),
    ],
  },
  {
    id: "memory-keepsake",
    category: "Memory",
    prompt: "You find a dusty prototype drinking vessel with unexplained gurples. You keep it because…",
    options: [
      answer("g", "It unlocks a story I refuse to lose.", "geoff", "sentimental archive", "You valued the object as a physical index to shared history."),
      answer("v", "I finally want to work out what it was supposed to do.", "gavin", "delayed investigation", "You reopened an old mystery because the mechanism still mattered."),
      answer("a", "Its existence proves I was right about something very specific.", "andrew", "evidentiary keepsake", "You preserved an artifact with outstanding argumentative value."),
      answer("e", "I do not keep it. We can remember things without storing garbage.", "eric", "anti-clutter clarity", "You separated the memory from the unnecessary physical burden."),
    ],
  },
  {
    id: "memory-retelling",
    category: "Memory",
    prompt: "Two friends remember the first ceremonial bean-hole inspection differently. Your instinct?",
    options: [
      answer("e", "Agree on the important part and stop holding memory court.", "eric", "resolution instinct", "You protected the friendship from an unwinnable evidentiary hearing."),
      answer("a", "Reconstruct the timeline from messages, weather, and known facts.", "andrew", "forensic memory", "You believed the past could be recovered through sufficient context."),
      answer("g", "Tell both versions—the contradiction makes the story better.", "geoff", "plural storytelling", "You let competing memories add texture instead of canceling out."),
      answer("v", "Find the one detail that would prove which version is possible.", "gavin", "falsifiable memory", "You searched for the physical constraint that could settle the account."),
    ],
  },
  {
    id: "creative-gift",
    category: "Creative chaos",
    prompt: "You need a memorable gift for a friend who owns everything except a left-side-only tuxedo. You choose…",
    options: [
      answer("v", "A clever object that makes them ask how it works.", "gavin", "mechanical delight", "You gave them a question disguised as a present."),
      answer("g", "An artifact tied to a story only the two of us understand.", "geoff", "personal mythology", "You used shared history as the gift’s real material."),
      answer("e", "The genuinely useful thing they keep refusing to buy.", "eric", "practical care", "You expressed affection by solving the recurring problem."),
      answer("a", "Something hyper-specific they mentioned once three years ago.", "andrew", "precision surprise", "You rewarded one obscure detail with total commitment."),
    ],
  },
  {
    id: "creative-challenge",
    category: "Creative chaos",
    prompt: "Your friends invent a “100 pees” challenge without defining a pee. You improve it by…",
    options: [
      answer("a", "Adding a category system and one controversial exception.", "andrew", "structured absurdity", "You made nonsense richer by giving it a defensible internal law."),
      answer("e", "Defining a finish line before this consumes the month.", "eric", "containment", "You gave the bit a shape that humans could complete."),
      answer("g", "Raising the emotional stakes far beyond what is appropriate.", "geoff", "dramatic commitment", "You supplied the unnecessary sincerity that makes a bit memorable."),
      answer("v", "Introducing a physical constraint nobody has tested.", "gavin", "experimental twist", "You made the challenge interesting by forcing reality to answer back."),
    ],
  },
  {
    id: "communication-voice-note",
    category: "Communication",
    prompt: "Your 20-second ankle update becomes a three-minute voice note because…",
    options: [
      answer("g", "The setup needs context, and the context has a story.", "geoff", "narrative layering", "You followed the update to the story that made it worth sending."),
      answer("v", "I keep discovering questions while explaining the answer.", "gavin", "recursive curiosity", "Your explanation generated fresh mysteries faster than it resolved them."),
      answer("a", "I need to rule out several interpretations of what I mean.", "andrew", "precision framing", "You protected the message from every foreseeable misreading."),
      answer("e", "It does not. I send the 20-second update.", "eric", "communication economy", "You gave the group the exact amount of information promised."),
    ],
  },
  {
    id: "communication-meeting",
    category: "Communication",
    prompt: "A meeting about a supplemental sausage draft drifts ten minutes away from its purpose. You say…",
    options: [
      answer("e", "“Hang on. What are we actually deciding?”", "eric", "agenda rescue", "You named the missing decision and pulled everyone back to it."),
      answer("a", "“This is related, because the original premise was…”", "andrew", "premise recovery", "You connected the tangent to the underlying architecture."),
      answer("v", "“Before we move on, why does it work that way?”", "gavin", "productive derailment", "You delayed the agenda for a question that might genuinely matter."),
      answer("g", "Nothing. I am already telling the tangent’s best story.", "geoff", "tangent ownership", "You accepted responsibility for making the detour worthwhile."),
    ],
  },
  {
    id: "crisis-fireplace",
    category: "Minor crisis",
    prompt: "The eight-hour fireplace video freezes at 7:59:58 and the room immediately feels colder. You...",
    options: [
      answer("v", "Replay the last ten seconds to test whether digital fire has thermal momentum.", "gavin", "impossible experiment", "You responded to emotional nonsense with a technically observable test.", "andrew"),
      answer("g", "Explain why those final two seconds represented everything we lost this year.", "geoff", "emotional escalation", "You found a sincere ending inside a broken novelty video.", "andrew"),
      answer("e", "Put on another fireplace. There are thousands of fireplaces.", "eric", "abundant solution", "You refused to let symbolic scarcity delay an obvious fix."),
      answer("a", "Argue that we completed the video because no new fire event could occur in two seconds.", "andrew", "completion doctrine", "You created a precise legal theory of when a fireplace video has ended."),
    ],
  },
  {
    id: "story-bog",
    category: "Storytelling",
    prompt: "Someone asks why you were standing in a bog at dawn holding salad cream. Your opening line is...",
    options: [
      answer("a", "'The important context is that I did not initially understand it to be a bog.'", "andrew", "contextual defense", "You began by relocating responsibility into the definition of the setting."),
      answer("e", "'It was a bad plan. The salad cream is not the important part.'", "eric", "triaged retelling", "You identified the one detail everyone would misuse and tried to remove it."),
      answer("g", "'To explain the salad cream, I have to tell you about my grandfather.'", "geoff", "generational setup", "You located the much older story hiding behind the current wet trousers."),
      answer("v", "'Do you mean why the bog, why dawn, or why salad cream?'", "gavin", "question splitting", "You separated one absurd image into three answerable mysteries."),
    ],
  },
  {
    id: "rules-regulation-status",
    category: "Rules & loopholes",
    prompt: "A tribunal must decide whether owning a pencil makes someone a Regulation Pencil Owner. Your ruling?",
    options: [
      answer("e", "Yes. They own the pencil. Next case.", "eric", "format preservation", "You prevented a ceremonial title from consuming the entire docket."),
      answer("a", "Ownership is insufficient without a documented regulation use.", "andrew", "title doctrine", "You protected the title by inventing a qualification nobody requested."),
      answer("v", "What if the pencil is borrowed but has lived in their house for years?", "gavin", "boundary testing", "You found the exact household edge case that destabilized the ruling."),
      answer("g", "Only if the pencil has already caused them a memorable inconvenience.", "geoff", "earned mythology", "You required the object to generate lore before granting it status."),
    ],
  },
  {
    id: "curiosity-bog",
    category: "Curiosity",
    prompt: "A sign says 'DO NOT ENTER THE BOG' but gives no reason. What is bothering you most?",
    options: [
      answer("g", "Who made the sign and what happened to them afterward?", "geoff", "human backstory", "You were more interested in the doomed sign-maker than the prohibited landscape."),
      answer("v", "Where, physically, does damp ground become a bog?", "gavin", "threshold curiosity", "You needed the exact step where ordinary soil changed legal status."),
      answer("a", "Whether entering one inch counts as entering the bog.", "andrew", "minimum violation", "You found the smallest possible act that could test the wording."),
      answer("e", "Why anyone in this group thinks the missing reason is permission.", "eric", "risk translation", "You translated an enticing mystery back into a completely adequate warning."),
    ],
  },
  {
    id: "food-sloppy-joe",
    category: "Food decisions",
    prompt: "Sloppy Joe's Bingo needs a tie-breaker. Unfortunately, the final category is 'structural integrity.' You...",
    options: [
      answer("v", "Tilt each sandwich by five degrees until one experiences a structural event.", "gavin", "destructive testing", "You designed a physical test with a visible and delicious failure state."),
      answer("e", "Take one vote. Nobody is building a sandwich laboratory.", "eric", "format rescue", "You defended the game from the infrastructure it was rapidly acquiring."),
      answer("a", "Define integrity as filling retained per bite, not total collapse time.", "andrew", "metric invention", "You improved the category by making it much harder to explain."),
      answer("g", "Give it to the sandwich that failed in the most moving way.", "geoff", "narrative judging", "You evaluated structural failure by its emotional and theatrical impact."),
    ],
  },
  {
    id: "tech-confidence-machine",
    category: "Technology",
    prompt: "A machine claims it can measure confidence, but the only output is a warm grape. You test it by...",
    options: [
      answer("a", "Establishing a baseline grape from a person with no opinion.", "andrew", "control premise", "You accepted the machine only after designing a philosophically difficult control group."),
      answer("g", "Telling the machine my most humiliating story and seeing what grape comes out.", "geoff", "vulnerability test", "You offered genuine personal stakes to an appliance producing warm fruit."),
      answer("v", "Running the same person twice and measuring grape temperature.", "gavin", "repeatability", "You asked the warm grape for the one thing every scientific result owes us."),
      answer("e", "Turning it off because we already have grapes and can simply ask people.", "eric", "tool rejection", "You noticed the machine had automated neither confidence nor fruit."),
    ],
  },
  {
    id: "competition-draft",
    category: "Competition",
    prompt: "In a draft of things that should never be drafted, someone selects 'drafts' first overall. Your response?",
    options: [
      answer("e", "Allow it, write it down, and keep the picks moving.", "eric", "commissioner discipline", "You survived a format-threatening pick by treating it as routine paperwork."),
      answer("a", "Challenge it because this specific draft proves drafts can be drafted.", "andrew", "self-reference appeal", "You attacked the pick with the paradox created by its own selection."),
      answer("g", "Respect it. That pick will be discussed for generations.", "geoff", "legacy scoring", "You valued the pick for the folklore it immediately produced."),
      answer("v", "Ask whether selecting 'drafts' also reserves every future draft.", "gavin", "scope question", "You discovered the frightening practical consequence inside the joke."),
    ],
  },
  {
    id: "social-sausage-talk",
    category: "Social energy",
    prompt: "You are invited onto Sausage Talk 9. Nobody will tell you what happened in Sausage Talks 1 through 8. You...",
    options: [
      answer("g", "Arrive with a personal sausage story and trust the format to reveal itself.", "geoff", "story offering", "You brought the room a sincere narrative sacrifice instead of requesting instructions."),
      answer("v", "Listen for five minutes, then ask whether a hot dog has entered the discussion.", "gavin", "taxonomy curiosity", "You found the forbidden classification question waiting inside the title."),
      answer("e", "Ask who is hosting and when this ends.", "eric", "production questions", "You sought the two pieces of information most likely to save everyone."),
      answer("a", "Prepare nine separate definitions of sausage so I cannot be blindsided.", "andrew", "semantic armor", "You entered casual sausage conversation protected against every known interpretation."),
    ],
  },
  {
    id: "planning-goof-world",
    category: "Planning",
    prompt: "You have one afternoon to open Goof World. The park currently has a chair, a hose, and a waiver written in pencil. You prioritize...",
    options: [
      answer("e", "A closing time, a first-aid kit, and removing the word 'waiver.'", "eric", "minimum viable safety", "You identified the operating requirements missing from the word 'World.'"),
      answer("g", "An opening ceremony that makes the chair feel historically important.", "geoff", "ceremonial lore", "You gave the attraction a past before it had technically opened."),
      answer("v", "Working out whether the hose can propel the chair.", "gavin", "ride engineering", "You saw two unrelated objects and immediately discovered the park's first ride."),
      answer("a", "A map with three lands, despite all three currently being the chair.", "andrew", "conceptual expansion", "You established the complete fictional infrastructure before acquiring physical space."),
    ],
  },
  {
    id: "disagreement-tuxedo",
    category: "Disagreement",
    prompt: "The group cannot agree whether a tuxedo worn only on the left half of the body is formalwear. You argue...",
    options: [
      answer("v", "Formality should be measured from the dressed side only if photographed correctly.", "gavin", "viewpoint mechanics", "You made the outfit's status depend on an observable angle."),
      answer("g", "It is formalwear if the occasion becomes a story worth retelling.", "geoff", "occasion logic", "You let the memory confer dignity on an objectively incomplete outfit."),
      answer("e", "It is half a tuxedo. Wear clothes to the event.", "eric", "noun enforcement", "You defended language and the event from a completely avoidable stunt."),
      answer("a", "It is formalwear on the left and casualwear on the right; both can be true.", "andrew", "split classification", "You resolved the dispute by giving each side its own jurisdiction."),
    ],
  },
  {
    id: "memory-panton",
    category: "Memory",
    prompt: "A ten-year-old message reads only 'PENCIL. THURSDAY. DO NOT LET GAVIN KNOW.' Nobody remembers it. You...",
    options: [
      answer("a", "Search every adjacent message until the original scenario is reconstructed.", "andrew", "archive excavation", "You treated three alarming fragments as a recoverable legal record."),
      answer("e", "Delete nothing, investigate nothing, and continue having a Thursday.", "eric", "historical containment", "You denied an old unexploded bit the oxygen required to restart."),
      answer("v", "Ask why I specifically was excluded and whether the pencil still exists.", "gavin", "personal mystery", "You found both the unanswered motive and the missing physical evidence."),
      answer("g", "Declare the message an important artifact and invent the most plausible lost episode.", "geoff", "memory mythology", "You filled an archival gap with a story strong enough to become memory."),
    ],
  },
  {
    id: "creative-fireplace",
    category: "Creative chaos",
    prompt: "You must improve an eight-hour fireplace video without adding more fire. Your contribution is...",
    options: [
      answer("g", "A quiet off-screen family saga that resolves in hour seven.", "geoff", "ambient storytelling", "You hid a complete emotional arc beside an unchanged rectangle of fire."),
      answer("a", "A second fireplace visible only under a rigorously defined condition.", "andrew", "conditional worldbuilding", "You added complexity without technically violating the single-fireplace premise."),
      answer("v", "One log that falls so slowly viewers debate whether it moved.", "gavin", "perceptual experiment", "You turned passive viewing into an eight-hour measurement dispute."),
      answer("e", "A chapter menu. Eight hours is not a personality.", "eric", "usability intervention", "You improved the art by acknowledging the existence of human schedules."),
    ],
  },
  {
    id: "communication-supplemental",
    category: "Communication",
    prompt: "You must announce that the emergency supplemental supplemental has been postponed. Your message is...",
    options: [
      answer("e", "'It is postponed. There is no third supplemental.'", "eric", "message containment", "You closed the exact loophole the audience was already preparing to enter."),
      answer("a", "A clarification of which supplemental modified which original event.", "andrew", "version control", "You preserved the complete lineage of an announcement nobody could now summarize."),
      answer("v", "A question about whether postponing an emergency makes it more or less emergency.", "gavin", "status curiosity", "You found the temporal contradiction inside the administrative update."),
      answer("g", "A heartfelt account of everything the supplemental meant to us.", "geoff", "ceremonial cancellation", "You gave a scheduling correction the emotional dignity of a series finale."),
    ],
  },
];

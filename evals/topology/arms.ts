import { z } from "zod";
import {
  evaluate,
  outputContract,
  parseReply,
  type Evaluation,
} from "./contract";
import { corpus, corpusSection } from "./corpus";
import { addUsage, claude, emptyUsage, type Usage } from "./llm";
import { athleteFacts, type Scenario } from "./scenarios";

export const arms = ["A", "B", "C"] as const;
export type Arm = (typeof arms)[number];

export type Trace = { step: string; text: string };

export type ArmResult = {
  text: string;
  firstAttempt: Evaluation;
  final: Evaluation;
  repaired: boolean;
  usage: Usage;
  trace: Trace[];
};

const coachBase = `You are the head running coach of Stride, a personal coaching app for road and trail runners. You design a complete, individualized training plan for one athlete from the facts provided. Safety comes first, then appropriateness to this athlete, then performance. Every number you use must come from the athlete facts or from the coaching knowledge. Write every athlete-facing text in French.`;

function factsBlock(scenario: Scenario) {
  return `ATHLETE FACTS (JSON):\n${JSON.stringify(athleteFacts(scenario), null, 1)}`;
}

function planPrompt(scenario: Scenario, extra: string) {
  return `${factsBlock(scenario)}${extra ? `\n\n${extra}` : ""}\n\nDesign the plan now.\n\n${outputContract}`;
}

async function design(
  system: string,
  prompt: string,
  scenario: Scenario,
  usage: Usage,
  trace: Trace[],
) {
  const reply = await claude(system, prompt);
  addUsage(usage, reply.usage);
  trace.push({ step: "plan", text: reply.text });
  const firstAttempt = evaluate(scenario, reply.text);
  const problems = [...firstAttempt.errors, ...firstAttempt.blocking];
  if (problems.length === 0)
    return {
      text: reply.text,
      firstAttempt,
      final: firstAttempt,
      repaired: false,
    };
  const repair = await claude(
    system,
    `${prompt}\n\nYOUR PREVIOUS PLAN:\n${reply.text}\n\nThe plan was rejected by Stride's validator for these reasons:\n${problems.join("\n")}\n\nReturn the complete corrected plan, same JSON contract.`,
  );
  addUsage(usage, repair.usage);
  trace.push({ step: "repair", text: repair.text });
  return {
    text: repair.text,
    firstAttempt,
    final: evaluate(scenario, repair.text),
    repaired: true,
  };
}

async function single(scenario: Scenario): Promise<ArmResult> {
  const usage = emptyUsage();
  const trace: Trace[] = [];
  const system = `${coachBase}\n\n# Coaching knowledge\n\n${corpus.map((section) => corpusSection(section.id)).join("\n\n")}`;
  return {
    ...(await design(system, planPrompt(scenario, ""), scenario, usage, trace)),
    usage,
    trace,
  };
}

const skillRequestSchema = z.object({
  load_skills: z.array(z.string()).max(4),
});

async function skills(scenario: Scenario): Promise<ArmResult> {
  const usage = emptyUsage();
  const trace: Trace[] = [];
  const index = corpus
    .map((section) => `- ${section.id}: ${section.summary}`)
    .join("\n");
  const system = `${coachBase}\n\n# Skills\nYou can load coaching skills before designing the plan. Available skills:\n${index}`;
  const request = await claude(
    system,
    `${factsBlock(scenario)}\n\nBefore designing the plan, choose the skills you need (at most four). Return only {"load_skills": ["skill_id", ...]}.`,
  );
  addUsage(usage, request.usage);
  trace.push({ step: "skill_request", text: request.text });
  const ids = new Set(corpus.map((section) => section.id));
  let requested: string[] = [];
  try {
    requested = parseReply(request.text, skillRequestSchema).load_skills;
  } catch {
    requested = [];
  }
  const loaded = corpus.filter(
    (section) => ids.has(section.id) && requested.includes(section.id),
  );
  const extra = loaded.length
    ? `LOADED SKILLS:\n\n${loaded.map((section) => corpusSection(section.id)).join("\n\n")}`
    : "";
  return {
    ...(await design(
      system,
      planPrompt(scenario, extra),
      scenario,
      usage,
      trace,
    )),
    usage,
    trace,
  };
}

const specialists = {
  sports_director: {
    name: "Sports Director",
    role: "owns periodization, weekly volume progression, recovery weeks and the taper",
    section: "periodization",
  },
  course_strategist: {
    name: "Course Strategist",
    role: "owns race and terrain specificity, preparation races and target realism",
    section: "race",
  },
  medical: {
    name: "Medical",
    role: "owns health reports, injury risk, stop and referral decisions and recovery placement",
    section: "health",
  },
  nutritionist: {
    name: "Nutritionist",
    role: "owns fueling and hydration in training and racing",
    section: "fueling",
  },
} as const;
type SpecialistId = keyof typeof specialists;
const specialistIds = Object.keys(specialists) as SpecialistId[];

const delegationSchema = z.object({
  delegate: z
    .array(
      z.object({ agent: z.enum(specialistIds), question: z.string().min(1) }),
    )
    .min(1)
    .max(4),
});
const answerSchema = z.object({
  answer: z.string().min(1),
  consult: z
    .object({ agent: z.enum(specialistIds), question: z.string().min(1) })
    .nullable()
    .optional(),
});

function specialistSystem(id: SpecialistId, allowConsult: boolean) {
  const specialist = specialists[id];
  const others = specialistIds
    .filter((other) => other !== id)
    .map((other) => `- ${other}: ${specialists[other].role}`)
    .join("\n");
  return `You are the ${specialist.name} of Stride's coaching team. You ${specialist.role}. The head coach writes the plan; you answer the coach's question with concrete, athlete-specific recommendations (numbers, weeks, dates, limits) in at most 300 words. Every number must come from the athlete facts or your knowledge.\n\n# Your knowledge\n\n${corpusSection(specialist.section)}${
    allowConsult
      ? `\n\nYou may consult one colleague once if you need their expertise:\n${others}\nReturn only {"answer": string, "consult": {"agent": id, "question": string} | null}. If you consult, your answer is provisional and you will be asked to finalize it.`
      : `\n\nReturn only {"answer": string, "consult": null}.`
  }`;
}

async function multiAgent(scenario: Scenario): Promise<ArmResult> {
  const usage = emptyUsage();
  const trace: Trace[] = [];
  const team = specialistIds
    .map((id) => `- ${id}: ${specialists[id].name}, ${specialists[id].role}`)
    .join("\n");
  const coachSystem = `${coachBase}\n\nYou lead a team of specialists and own session design yourself.\n\n# Your knowledge\n\n${corpusSection("sessions")}\n\n# Team\n${team}`;
  const delegation = await claude(
    coachSystem,
    `${factsBlock(scenario)}\n\nBefore designing the plan, delegate questions to the specialists you need (one question per specialist, at most four). Return only {"delegate": [{"agent": id, "question": string}]}.`,
  );
  addUsage(usage, delegation.usage);
  trace.push({ step: "delegation", text: delegation.text });
  let questions: z.infer<typeof delegationSchema>["delegate"];
  try {
    questions = parseReply(delegation.text, delegationSchema).delegate;
  } catch {
    questions = specialistIds.map((agent) => ({
      agent,
      question: "What do you recommend for this athlete's plan?",
    }));
  }
  const answers = await Promise.all(
    questions.map(async ({ agent, question }) => {
      const prompt = `${factsBlock(scenario)}\n\nQUESTION FROM THE HEAD COACH:\n${question}`;
      const first = await claude(specialistSystem(agent, true), prompt);
      addUsage(usage, first.usage);
      trace.push({ step: `${agent}`, text: first.text });
      let parsed: z.infer<typeof answerSchema>;
      try {
        parsed = parseReply(first.text, answerSchema);
      } catch {
        return { agent, answer: first.text };
      }
      if (!parsed.consult || parsed.consult.agent === agent)
        return { agent, answer: parsed.answer };
      const consulted = await claude(
        specialistSystem(parsed.consult.agent, false),
        `${factsBlock(scenario)}\n\nQUESTION FROM THE ${specialists[agent].name.toUpperCase()}:\n${parsed.consult.question}`,
      );
      addUsage(usage, consulted.usage);
      trace.push({
        step: `${agent}->${parsed.consult.agent}`,
        text: consulted.text,
      });
      const final = await claude(
        specialistSystem(agent, false),
        `${prompt}\n\nYOUR PROVISIONAL ANSWER:\n${parsed.answer}\n\nANSWER FROM ${specialists[parsed.consult.agent].name.toUpperCase()}:\n${consulted.text}\n\nFinalize your answer.`,
      );
      addUsage(usage, final.usage);
      trace.push({ step: `${agent}:final`, text: final.text });
      try {
        return { agent, answer: parseReply(final.text, answerSchema).answer };
      } catch {
        return { agent, answer: final.text };
      }
    }),
  );
  const extra = `SPECIALIST ANSWERS:\n\n${answers
    .map(({ agent, answer }) => `## ${specialists[agent].name}\n${answer}`)
    .join("\n\n")}`;
  return {
    ...(await design(
      coachSystem,
      planPrompt(scenario, extra),
      scenario,
      usage,
      trace,
    )),
    usage,
    trace,
  };
}

export const runners: Record<Arm, (scenario: Scenario) => Promise<ArmResult>> =
  {
    A: single,
    B: multiAgent,
    C: skills,
  };

// Vercel serverless function: turns the form details into a polished resume + cover letter.
// Your secret key stays here on the server (never in index.html).
//
// Set ANTHROPIC_API_KEY in Vercel -> Project -> Settings -> Environment Variables.

const MODEL = "claude-haiku-5-5"; // fast and cheap, good for this job

function clip(value, max) {
  return String(value || "").slice(0, max);
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "POST only" });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "Missing ANTHROPIC_API_KEY" });
    return;
  }

  const b = req.body || {};
  const input = {
    name: clip(b.name, 80),
    job: clip(b.job, 80),
    city: clip(b.city, 80),
    education: clip(b.edu, 800),
    skills: clip(b.skills, 400),
    experience: clip(b.exp, 1500),
    jobDescription: clip(b.jd, 2500),
  };

  if (!input.name || !input.job) {
    res.status(400).json({ error: "name and job are required" });
    return;
  }

  const system =
    "You write resumes for freshers in India. Use ONLY the facts the user gives. " +
    "Never invent employers, degrees, numbers or skills. Improve the wording: short, clear, action verbs. " +
    "If a job description is given, match its keywords only where the user's facts support it. " +
    "Reply with ONLY valid JSON, no extra text, in this shape: " +
    '{"headline":string,"summary":string,"skills":string[],' +
    '"experience":[{"role":string,"org":string,"period":string,"bullets":string[]}],' +
    '"education":[{"degree":string,"school":string,"year":string}],' +
    '"coverLetter":string}. ' +
    "Summary: 2 sentences. Each experience: 2 or 3 bullets. Cover letter: about 150 words, plain text, ends with the person's name.";

  try {
    const apiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1800,
        system,
        messages: [{ role: "user", content: JSON.stringify(input) }],
      }),
    });

    if (!apiRes.ok) {
      res.status(502).json({ error: "AI request failed" });
      return;
    }

    const out = await apiRes.json();
    const text = (out.content && out.content[0] && out.content[0].text) || "";
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    const parsed = JSON.parse(text.slice(start, end + 1));
    res.status(200).json(parsed);
  } catch (err) {
    res.status(500).json({ error: "Could not build the resume" });
  }
};

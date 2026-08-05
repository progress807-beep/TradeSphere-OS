// Netlify serverless function.
// Runs server-side only — your ANTHROPIC_API_KEY never reaches the browser.
// Set ANTHROPIC_API_KEY in Netlify: Site configuration > Environment variables.

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  let payload;
  try {
    payload = JSON.parse(event.body);
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid request body" }) };
  }

  const { docType, companyName, clientName, projectDesc, amount, projDate } = payload;

  if (!docType) {
    return { statusCode: 400, body: JSON.stringify({ error: "docType is required" }) };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: "Server is missing ANTHROPIC_API_KEY" }) };
  }

  const safe = (v, fallback) => (v && String(v).trim() ? String(v).trim() : fallback);

  const prompt = `You are filling in a professional ${docType} template for a contractor. Use plain text formatting only (no markdown symbols like # or **), with clear section headers in ALL CAPS and blank lines between sections, suitable for pasting into a plain text editor or a Word document.

Details to use:
- Contractor / Company Name: ${safe(companyName, "[Your Company Name]")}
- Client Name: ${safe(clientName, "[Client Name]")}
- Project Description: ${safe(projectDesc, "[Project description not provided]")}
- Amount/Price: ${safe(amount, "[Amount]")}
- Date: ${safe(projDate, "[Date]")}

Write a complete, professional, realistic ${docType} using these details. Include standard sections appropriate for this document type (e.g. for a contract: scope of work, payment schedule, timeline, warranty; for an invoice: line items, totals, payment terms; for a checklist: relevant checkpoints). Where information wasn't provided, use reasonable bracketed placeholders like [Insert start date]. Keep it concise — around 300-400 words.`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 1000,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return { statusCode: response.status, body: JSON.stringify({ error: "Anthropic API error", detail: errText }) };
    }

    const data = await response.json();
    const text = (data.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};

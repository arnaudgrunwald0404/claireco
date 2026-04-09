// Netlify Function — extracts structured PRD data from a conversation transcript
// Non-streaming: waits for full Claude response, returns JSON

const EXTRACTION_PROMPT = `You are a data extraction assistant. Given the following conversation transcript between Claire and an employee at ClearCompany, extract the following fields and return them as JSON only. No preamble, no explanation, just the JSON object.

Fields to extract:
{
  "pain_summary": "One sentence description of the core pain point",
  "frequency": "How often this happens (daily/weekly/monthly/ad-hoc)",
  "systems_involved": ["array", "of", "tools", "mentioned"],
  "people_affected": "Number or description of who is affected",
  "time_impact": "How much time this costs (per occurrence or per week)",
  "success_criteria": "What good looks like if this is solved",
  "edge_cases": "Any special constraints, sensitivities, or exceptions mentioned",
  "match_type": "known or new",
  "matched_use_case_id": null,
  "confidence": "high or medium or low",
  "readiness": "ready_to_build or needs_followup or exploratory"
}

If a field cannot be determined from the transcript, use null for that field.

Conversation transcript:
`;

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
      body: '',
    };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'ANTHROPIC_API_KEY is not configured' }),
    };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, body: 'Invalid JSON body' };
  }

  const { transcript, matchedUseCaseId, path, department } = payload;

  if (!transcript) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'transcript is required' }),
    };
  }

  // Build extraction prompt with known context
  let prompt = EXTRACTION_PROMPT + transcript;
  if (matchedUseCaseId) {
    prompt += `\n\nNote: This conversation matched use case #${matchedUseCaseId}. Set matched_use_case_id to ${matchedUseCaseId} and match_type to "known".`;
  } else {
    prompt += `\n\nNote: No existing use case was matched. Set match_type to "new" and matched_use_case_id to null.`;
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Anthropic error ${response.status}: ${err}`);
    }

    const data = await response.json();
    const rawText = data.content[0].text.trim();

    // Strip markdown code fences if Claude wrapped the JSON
    const jsonText = rawText
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '')
      .trim();

    const brief = JSON.parse(jsonText);

    // Attach metadata
    brief.brief_ref = 'AGT-' + (1000 + Math.floor(Math.random() * 9000));
    brief.department = department || null;
    brief.created_at = new Date().toISOString();
    brief.path = path || (matchedUseCaseId ? 'A' : 'C');

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(brief),
    };
  } catch (error) {
    console.error('extract-brief error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ error: error.message }),
    };
  }
};

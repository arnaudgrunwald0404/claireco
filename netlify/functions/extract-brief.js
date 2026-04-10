// Netlify Function — extracts structured PRD data from a conversation transcript
// then persists the brief and updates the conversation in Supabase.

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

// Minimal Supabase client using REST API directly (no npm needed)
async function supabaseRequest(url, serviceRoleKey, method, body) {
  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'apikey': serviceRoleKey,
      'Authorization': `Bearer ${serviceRoleKey}`,
      'Prefer': method === 'POST' ? 'return=representation' : 'return=minimal',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  try { return { ok: res.ok, status: res.status, data: JSON.parse(text) }; }
  catch { return { ok: res.ok, status: res.status, data: text }; }
}

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

  const anthropicKey  = process.env.ANTHROPIC_API_KEY;
  const supabaseUrl   = process.env.SUPABASE_URL;
  const serviceKey    = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!anthropicKey) {
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

  const {
    transcript,
    matchedUseCaseId,
    path,
    department,
    conversationId,   // Supabase conversations.id (uuid)
    userId,           // Supabase profiles.id (uuid)
  } = payload;

  if (!transcript) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'transcript is required' }),
    };
  }

  // ── 1. Extract structured brief via Claude ────────────────────
  let prompt = EXTRACTION_PROMPT + transcript;
  if (matchedUseCaseId) {
    prompt += `\n\nNote: This conversation matched use case #${matchedUseCaseId}. Set matched_use_case_id to ${matchedUseCaseId} and match_type to "known".`;
  } else {
    prompt += `\n\nNote: No existing use case was matched. Set match_type to "new" and matched_use_case_id to null.`;
  }

  let brief;
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
        'x-api-key': anthropicKey,
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) throw new Error(`Anthropic error ${response.status}`);

    const data = await response.json();
    const rawText = data.content[0].text.trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '')
      .trim();

    brief = JSON.parse(rawText);
  } catch (err) {
    console.error('Claude extraction error:', err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: `Extraction failed: ${err.message}` }),
    };
  }

  // ── 2. Persist to Supabase (if configured) ────────────────────
  let supabaseBriefId = null;

  if (supabaseUrl && serviceKey) {
    const briefRow = {
      conversation_id:     conversationId  || null,
      user_id:             userId          || null,
      department:          department      || null,
      pain_summary:        brief.pain_summary        || null,
      frequency:           brief.frequency           || null,
      systems_involved:    Array.isArray(brief.systems_involved) ? brief.systems_involved : [],
      people_affected:     brief.people_affected     || null,
      time_impact:         brief.time_impact         || null,
      success_criteria:    brief.success_criteria    || null,
      edge_cases:          brief.edge_cases          || null,
      match_type:          brief.match_type          || (matchedUseCaseId ? 'known' : 'new'),
      matched_use_case_id: brief.matched_use_case_id || matchedUseCaseId || null,
      confidence:          brief.confidence          || 'medium',
      readiness:           brief.readiness           || 'exploratory',
      status:              'pending',
    };

    try {
      // Insert brief row (brief_ref auto-generated by DB trigger)
      const briefRes = await supabaseRequest(
        `${supabaseUrl}/rest/v1/briefs`,
        serviceKey,
        'POST',
        briefRow
      );

      if (briefRes.ok && Array.isArray(briefRes.data) && briefRes.data[0]) {
        supabaseBriefId = briefRes.data[0].id;
        brief.brief_ref = briefRes.data[0].brief_ref;
        brief.id        = briefRes.data[0].id;
      } else {
        console.warn('Brief insert returned unexpected data:', briefRes);
      }

      // Update conversation to completed
      if (conversationId) {
        await supabaseRequest(
          `${supabaseUrl}/rest/v1/conversations?id=eq.${conversationId}`,
          serviceKey,
          'PATCH',
          {
            status:       'completed',
            path:          path || (matchedUseCaseId ? 'A' : 'C'),
            match_confirmed: path === 'A',
            completed_at: new Date().toISOString(),
          }
        );
      }

      // Insert use_case_submission for analytics
      if (matchedUseCaseId && supabaseBriefId) {
        await supabaseRequest(
          `${supabaseUrl}/rest/v1/use_case_submissions`,
          serviceKey,
          'POST',
          {
            use_case_id: matchedUseCaseId,
            brief_id:    supabaseBriefId,
            department:  department || null,
            confirmed:   path === 'A',
          }
        );

        // Increment use case match count
        await supabaseRequest(
          `${supabaseUrl}/rest/v1/rpc/increment_match_count`,
          serviceKey,
          'POST',
          { use_case_id_param: matchedUseCaseId }
        );
      }

    } catch (err) {
      // Log but don't fail — return the brief even if DB write fails
      console.error('Supabase write error:', err);
    }
  }

  // ── 3. Return brief to client ─────────────────────────────────
  // Fall back to client-side ref if Supabase didn't generate one
  if (!brief.brief_ref) {
    brief.brief_ref = 'AGT-' + (1000 + Math.floor(Math.random() * 9000));
  }
  brief.department  = department || null;
  brief.created_at  = new Date().toISOString();
  brief.path        = path || (matchedUseCaseId ? 'A' : 'C');

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify(brief),
  };
};

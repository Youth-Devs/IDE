import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { instruction, repositoryStructure, contextFiles, modelSelection } = await request.json();
    const apiKey = process.env.GEMINI_API_KEY; 

    if (!apiKey) {
      return NextResponse.json({ error: 'Missing API Key configuration' }, { status: 500 });
    }

    const activeEngineModel = modelSelection || 'gemini-3.1-flash-lite';

    const systemContext = `You are an automated filesystem compiler agent with full structural write, create, and delete privileges over this repository.
You are given the structure of the project ([REPOSITORY MAP]), the contents of user selected context modules ([ATTACHED FILE CONTENT]), and a workspace instruction ([USER INSTRUCTION]).

CRITICAL INSTRUCTION ACTION RULES:
1. "update": If the user requests alterations to an existing file name, return action "update" with its rewritten content.
2. "create": If the instruction calls for building a feature that requires a brand new file, return action "create" along with the new file's fully developed starting code.
3. "delete": If the user explicitly asks to drop, delete, remove, or destroy a specific file, return action "delete" for that file name. Content string for a delete action can be left blank.
4. Keep file generation lean and return structural JSON parameters only. Do NOT include markdown styling wrappers or fences like \`\`\`json.

OUTPUT STRUCTURE SPECIFICATION:
{
  "filePatches": [
    {
      "name": "filename.extension",
      "action": "create" | "update" | "delete",
      "content": "Complete file content payload (Required for create and update actions)"
    }
  ]
}`;

    const promptPayload = `
${systemContext}

[REPOSITORY MAP]:
${JSON.stringify(repositoryStructure, null, 2)}

[ATTACHED FILE CONTENT]:
${JSON.stringify(contextFiles, null, 2)}

[USER INSTRUCTION]:
${instruction}

RESPONSE JSON:`;

    const payload = {
      contents: [{
        parts: [{ text: promptPayload }]
      }]
    };

    const endpoint = `https://generativelanguage.googleapis.com/v1/models/${activeEngineModel}:generateContent?key=${apiKey}`;
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorData = await response.text();
      return NextResponse.json({ error: `Gemini Agent Error: ${errorData}` }, { status: response.status });
    }

    const data = await response.json();
    let rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    let cleanJsonString = rawText.trim();
    if (cleanJsonString.startsWith('```json')) {
      cleanJsonString = cleanJsonString.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleanJsonString.startsWith('```')) {
      cleanJsonString = cleanJsonString.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    const parsedData = JSON.parse(cleanJsonString.trim());
    return NextResponse.json({ filePatches: parsedData.filePatches });

  } catch (error) {
    // 🚀 FIXED: Added the missing closing quote and parentheses right here!
    console.error('Agent route mapping crash:', error);
    return NextResponse.json({ error: 'System architecture payload format mismatch.' }, { status: 500 });
  }
}
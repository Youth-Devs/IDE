import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { currentCode, instruction } = await request.json();
    const apiKey = process.env.GEMINI_API_KEY; 

    if (!apiKey) {
      return NextResponse.json({ error: 'Missing API Credentials Configuration' }, { status: 500 });
    }

    const systemContext = `You are the backend automation compilation layer for the YouthDevs Vibe IDE. 
Your single job is to read the current source code and alter it following the instruction provided by the user.

CRITICAL IMPLEMENTATION RULES:
1. Return ONLY valid text source modifications.
2. Do NOT format your final response with markdown fences blocks like \`\`\`html or structural commentary text.
3. Keep structural CDN integrations like Tailwind styles un-compromised unless explicit instruction overrides are targeted.
4. Output should start directly with the modified document format (e.g. <!DOCTYPE html>).`;

    const payload = {
      contents: [{
        parts: [{
          text: `${systemContext}\n\n[CURRENT CODE]:\n${currentCode}\n\n[USER INSTRUCTION]:\n${instruction}`
        }]
      }]
    };

    // 🚀 FIXED: Pointing directly to the active stable version of Gemini 2.5 Flash
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error("Google API Server rejected the request:", errorData);
      return NextResponse.json({ error: 'Google API rejection status' }, { status: response.status });
    }

    const data = await response.json();
    let rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    let cleanCode = rawText.trim();
    if (cleanCode.startsWith('```html')) {
      cleanCode = cleanCode.replace(/^```html\s*/, '').replace(/\s*```$/, '');
    } else if (cleanCode.startsWith('```')) {
      cleanCode = cleanCode.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    return NextResponse.json({ updatedCode: cleanCode.trim() });
  } catch (error) {
    console.error('Server Internal Vibe Exception:', error);
    return NextResponse.json({ error: 'Internal operational crash' }, { status: 500 });
  }
}
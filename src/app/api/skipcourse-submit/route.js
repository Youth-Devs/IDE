import { NextResponse } from 'next/server';

const DEFAULT_SUBMISSION_URL = 'https://deepvalidation.skipcourse.com/api/submit';

export async function POST(request) {
  try {
    const payload = await request.json();
    if (!payload?.userId || !Array.isArray(payload?.codeContent)) {
      return NextResponse.json({ error: 'A user ID and project files are required.' }, { status: 400 });
    }

    const response = await fetch(process.env.SKIPCOURSE_SUBMIT_URL || DEFAULT_SUBMISSION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const responseText = await response.text();

    if (!response.ok) {
      return NextResponse.json(
        { error: responseText || 'SkipCourse rejected the submission.' },
        { status: response.status }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('SkipCourse submission proxy failed:', error);
    return NextResponse.json(
      { error: error?.message || 'Unable to reach SkipCourse.' },
      { status: 502 }
    );
  }
}

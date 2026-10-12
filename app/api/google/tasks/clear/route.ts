import { NextRequest, NextResponse } from 'next/server';
import { getGoogleSession, attachRefreshedTokens } from '@/lib/google/session';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

function cleanId(id: string): string {
  const parts = id.split('::');
  return parts.length > 1 ? parts[1] : id;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { listId = '@default', googleAccountId } = body;

    const session = await getGoogleSession(request, {
      accountId: listId.startsWith('google:') ? listId : googleAccountId,
      app: 'tasks',
    });
    if (!session) {
      return NextResponse.json({ error: 'not_connected' }, { status: 401 });
    }

    const targetListId = cleanId(listId);

    const res = await fetch(`https://tasks.googleapis.com/tasks/v1/lists/${encodeURIComponent(targetListId)}/clear`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
      },
    });

    if (!res.ok && res.status !== 204) {
      logger.error('Failed to clear completed Google tasks', { status: res.status, listId: targetListId });
      return NextResponse.json({ error: 'google_api_error', status: res.status }, { status: 502 });
    }

    const response = NextResponse.json({ success: true });
    attachRefreshedTokens(response, session.refreshedTokens);
    return response;
  } catch (err) {
    logger.error('Exception clearing completed Google tasks', { err });
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}

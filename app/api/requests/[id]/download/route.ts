import { errorResponse } from '@/lib/errors';
import { requireUser } from '@/services/auth.service';
import { getDownloadableRequest, markDownloaded } from '@/services/request.service';
import { readStoredPdf } from '@/lib/uploads';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const row = await getDownloadableRequest(user, id);
    const fileUrl = String(row.fileUrl || '');
    const name = row.fileName || 'document.pdf';
    const asciiName = name.replace(/[^\x20-\x7E]/g, '-');
    const buf = await readStoredPdf(fileUrl);
    await markDownloaded(user, row);
    return new Response(new Uint8Array(buf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${asciiName}"`
      }
    });
  } catch (error) {
    return errorResponse(error);
  }
}

import { useState, useEffect, useRef } from 'react';
import { attachmentService, Attachment } from '../services/attachmentService';
import { useTheme } from '../context/ThemeContext';

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];
const DOC_ICON: Record<string, string> = {
  'application/pdf': '📄',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '📝',
};

interface Props {
  ticketId: number;
  userId: number;
  userRole: string;
}

export default function AttachmentSection({ ticketId, userId, userRole }: Props) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const inputRef = useRef<HTMLInputElement>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading]     = useState(false);
  const [clientError, setClientError] = useState('');
  const [loading, setLoading]         = useState(false);

  // Tokens de color coherentes con el dk palette del resto de la app
  const c = {
    sectionBg:  isDark ? 'transparent'  : 'transparent',
    divider:    isDark ? '#334155'      : '#e5e7eb',
    label:      isDark ? '#93c5fd'      : '#2563eb',
    cardBg:     isDark ? '#1e1e1e'      : '#f9fafb',
    cardBorder: isDark ? '#334155'      : '#e2e8f0',
    text:       isDark ? '#f5f5f5'      : '#1e293b',
    sub:        isDark ? '#aaaaaa'      : '#6b7280',
    btnBg:      isDark ? '#334155'      : '#e5e7eb',
    btnText:    isDark ? '#f1f5f9'      : '#374151',
  };

  const load = async () => {
    try {
      setLoading(true);
      const data = await attachmentService.getAttachments(ticketId);
      setAttachments(data);
    } catch {
      // fallo silencioso — no interrumpir la vista del ticket
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [ticketId]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setClientError('');

    if (!ALLOWED_TYPES.includes(file.type)) {
      setClientError('Formato no permitido. Use JPG, PNG, PDF o DOCX.');
      e.target.value = '';
      return;
    }
    if (file.size > MAX_SIZE) {
      setClientError(`El archivo supera el límite de 10 MB (tiene ${(file.size / 1024 / 1024).toFixed(1)} MB).`);
      e.target.value = '';
      return;
    }

    setUploading(true);
    try {
      await attachmentService.uploadAttachment(ticketId, file);
      await load();
    } catch (err: any) {
      setClientError(err.message ?? 'Error al subir el archivo.');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleDelete = async (att: Attachment) => {
    if (!window.confirm(`¿Eliminar "${att.original_name}"?`)) return;
    try {
      await attachmentService.deleteAttachment(att.id);
      setAttachments(prev => prev.filter(a => a.id !== att.id));
    } catch (err: any) {
      setClientError(err.message ?? 'Error al eliminar.');
    }
  };

  const isImage = (mime: string) => mime.startsWith('image/');
  const fmtSize  = (bytes: number) =>
    bytes >= 1024 * 1024
      ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
      : `${Math.round(bytes / 1024)} KB`;

  return (
    <div style={{ marginTop: '14px', borderTop: `1px dashed ${c.divider}`, paddingTop: '12px' }}>

      {/* Encabezado */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <span style={{ fontSize: '13px', fontWeight: 'bold', color: c.label }}>
          📎 Adjuntos ({attachments.length})
        </span>
        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          style={{
            backgroundColor: uploading ? (isDark ? '#475569' : '#94a3b8') : '#6366f1',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            padding: '5px 12px',
            fontSize: '12px',
            fontWeight: 'bold',
            cursor: uploading ? 'not-allowed' : 'pointer',
            marginTop: 0,
            width: 'auto',
          }}
        >
          {uploading ? 'Subiendo…' : '+ Adjuntar'}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".jpg,.jpeg,.png,.pdf,.docx"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />
      </div>

      {/* Error de validación */}
      {clientError && (
        <p style={{ color: '#ef4444', fontSize: '12px', margin: '0 0 8px 0' }}>
          ⚠️ {clientError}
        </p>
      )}

      {/* Lista de adjuntos */}
      {loading ? (
        <p style={{ fontSize: '12px', color: c.sub, margin: 0 }}>Cargando adjuntos…</p>
      ) : attachments.length === 0 ? (
        <p style={{ fontSize: '12px', color: c.sub, margin: 0 }}>Sin adjuntos aún.</p>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
          {attachments.map(att => (
            <div
              key={att.id}
              style={{
                backgroundColor: c.cardBg,
                border: `1px solid ${c.cardBorder}`,
                borderRadius: '8px',
                padding: '10px',
                width: '130px',
                position: 'relative',
                flexShrink: 0,
              }}
            >
              {/* Vista previa o ícono */}
              {isImage(att.mime_type) ? (
                <a
                  href={attachmentService.getFileUrl(att.filename)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <img
                    src={attachmentService.getFileUrl(att.filename)}
                    alt={att.original_name}
                    style={{
                      width: '100%', height: '76px', objectFit: 'cover',
                      borderRadius: '4px', cursor: 'pointer', display: 'block',
                    }}
                  />
                </a>
              ) : (
                <a
                  href={attachmentService.getFileUrl(att.filename)}
                  download={att.original_name}
                  style={{ textDecoration: 'none' }}
                >
                  <div style={{
                    height: '76px', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontSize: '38px', cursor: 'pointer',
                  }}>
                    {DOC_ICON[att.mime_type] ?? '📎'}
                  </div>
                </a>
              )}

              {/* Nombre del archivo */}
              <p style={{
                margin: '6px 0 2px 0', fontSize: '11px', color: c.text,
                fontWeight: '600', overflow: 'hidden',
                textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }} title={att.original_name}>
                {att.original_name}
              </p>

              {/* Metadatos */}
              <p style={{ margin: 0, fontSize: '10px', color: c.sub, lineHeight: '1.4' }}>
                {fmtSize(att.size)}<br />
                {att.uploader}
              </p>

              {/* Botón eliminar (solo dueño o admin) */}
              {(att.user_id === userId || userRole === 'administrador') && (
                <button
                  onClick={() => handleDelete(att)}
                  title="Eliminar adjunto"
                  style={{
                    position: 'absolute', top: '4px', right: '4px',
                    backgroundColor: 'rgba(239,68,68,0.85)',
                    color: 'white', border: 'none', borderRadius: '4px',
                    padding: '1px 6px', fontSize: '11px', cursor: 'pointer',
                    lineHeight: 1.4, marginTop: 0, width: 'auto',
                  }}
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

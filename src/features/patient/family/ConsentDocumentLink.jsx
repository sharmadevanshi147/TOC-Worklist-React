import { useState } from 'react';
import { Link } from '../../../components/Link/Link';
import { ImagePreviewOverlay } from '../../../components/ImagePreviewOverlay/ImagePreviewOverlay';
import { toast } from '../../../components/Toast/sonnerToast';
import { useAppStore } from '../../../store/useAppStore';

/**
 * A staff-recorded consent's signed form (FCS-4729): the file lives once in
 * the patient's Documents; Manage App Access and App Access History link to
 * it by id and open it in the document preview.
 */
export function ConsentDocumentLink({ documentId, name, className }) {
  const [doc, setDoc] = useState(null);
  const open = async () => {
    const find = () => useAppStore.getState().programDocuments.find(d => d.id === documentId);
    let found = find();
    if (!found) {
      await useAppStore.getState().fetchProgramDocuments();
      found = find();
    }
    if (!found) { toast.error('The consent document could not be found.'); return; }
    setDoc(found);
  };
  return (
    <>
      <Link className={className} onClick={open}>{name || 'Consent document'}</Link>
      {doc && <ImagePreviewOverlay doc={doc} onClose={() => setDoc(null)} />}
    </>
  );
}

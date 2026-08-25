export const VERIFICATION_DOCUMENT_STORAGE = Symbol(
  'VERIFICATION_DOCUMENT_STORAGE',
);

export interface VerificationDocumentStorage {
  put(objectKey: string, contents: Buffer, mimeType: string): Promise<void>;
  delete(objectKey: string): Promise<void>;
}

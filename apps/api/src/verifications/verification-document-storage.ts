export const VERIFICATION_DOCUMENT_STORAGE = Symbol(
  'VERIFICATION_DOCUMENT_STORAGE',
);

export interface VerificationDocumentStorage {
  put(objectKey: string, contents: Buffer, mimeType: string): Promise<void>;
  get(objectKey: string): Promise<Buffer>;
  delete(objectKey: string): Promise<void>;
}

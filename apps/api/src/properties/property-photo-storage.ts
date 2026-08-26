export const PROPERTY_PHOTO_STORAGE = Symbol('PROPERTY_PHOTO_STORAGE');

export interface PropertyPhotoStorage {
  put(objectKey: string, contents: Buffer, mimeType: string): Promise<void>;
  get(objectKey: string): Promise<Buffer>;
  delete(objectKey: string): Promise<void>;
}

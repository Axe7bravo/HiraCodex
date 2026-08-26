import { Injectable } from '@nestjs/common';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import type { PropertyPhotoStorage } from './property-photo-storage';

@Injectable()
export class LocalPropertyPhotoStorage implements PropertyPhotoStorage {
  private readonly root: string;

  constructor(root: string) {
    this.root = resolve(root);
  }

  async put(objectKey: string, contents: Buffer): Promise<void> {
    const destination = this.resolveObjectKey(objectKey);
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, contents, { flag: 'wx' });
  }

  get(objectKey: string): Promise<Buffer> {
    return readFile(this.resolveObjectKey(objectKey));
  }

  async delete(objectKey: string): Promise<void> {
    await rm(this.resolveObjectKey(objectKey), { force: true });
  }

  private resolveObjectKey(objectKey: string): string {
    const destination = resolve(this.root, objectKey);
    if (!destination.startsWith(`${this.root}${sep}`)) {
      throw new Error('Invalid property photo object key');
    }
    return destination;
  }
}

// Type declarations for zip.js library (UMD version)

declare namespace zip {
  class BlobWriter {
    constructor();
  }

  class BlobReader {
    constructor(blob: Blob);
  }

  class TextReader {
    constructor(text: string);
  }

  class Uint8ArrayReader {
    constructor(data: Uint8Array);
  }

  class ZipWriter {
    constructor(writer: BlobWriter);
    add(filename: string, reader: TextReader | Uint8ArrayReader): Promise<void>;
    close(): Promise<Blob>;
  }

  class ZipReader {
    constructor(reader: BlobReader);
    getEntries(): Promise<Entry[]>;
    close(): Promise<void>;
  }

  interface Entry {
    filename: string;
    getData(writer: BlobWriter): Promise<Blob>;
  }
}

declare module 'sharp' {
  interface SharpMetadata {
    format?: string;
    width?: number;
    height?: number;
    pageHeight?: number;
    delay?: number[];
    pages?: number;
  }

  interface SharpResizeOptions {
    fit?: string;
  }

  interface SharpWebpOptions {
    quality?: number;
  }

  interface SharpCompositeInput {
    input: Buffer;
    left?: number;
    top?: number;
  }

  interface SharpInput {
    create: {
      width: number;
      height: number;
      channels: number;
      background: {
        r: number;
        g: number;
        b: number;
        alpha: number;
      };
    };
  }

  interface SharpInstance {
    metadata(): Promise<SharpMetadata>;
    rotate(): SharpInstance;
    resize(
      width?: number,
      height?: number,
      options?: SharpResizeOptions,
    ): SharpInstance;
    webp(options?: SharpWebpOptions): SharpInstance;
    toBuffer(): Promise<Buffer>;
    composite(images: SharpCompositeInput[]): SharpInstance;
  }

  interface SharpOptions {
    animated?: boolean;
  }

  function sharp(
    input?: Buffer | SharpInput,
    options?: SharpOptions,
  ): SharpInstance;

  export default sharp;
}

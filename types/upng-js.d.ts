declare module 'upng-js' {
  interface DecodedImage {
    width: number;
    height: number;
  }

  interface UPNGModule {
    decode(buffer: ArrayBuffer): DecodedImage;
    toRGBA8(image: DecodedImage): ArrayBuffer[];
  }

  const UPNG: UPNGModule;
  export default UPNG;
}
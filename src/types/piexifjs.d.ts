declare module "piexifjs" {
  const piexif: {
    ImageIFD: { Orientation: number };
    GPSIFD: {
      GPSLatitudeRef: number;
      GPSLatitude: number;
      GPSLongitudeRef: number;
      GPSLongitude: number;
    };
    dump(data: unknown): string;
    insert(exif: string, jpegBinary: string): string;
  };

  export default piexif;
}

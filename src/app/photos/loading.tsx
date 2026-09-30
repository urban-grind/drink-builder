export default function LoadingPhotos() {
  return (
    <div role="status" aria-live="polite" className="ug-board -mx-4 flex flex-col gap-4 px-4 py-8 sm:-mx-6 sm:px-6">
      <p className="sr-only">Loading photos</p>
      <div className="h-36 animate-pulse bg-[#274b3a]" />
      {Array.from({ length: 3 }, (_, index) => (
        <div key={index} className="h-64 animate-pulse bg-white" />
      ))}
    </div>
  );
}

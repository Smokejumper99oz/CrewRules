type Props = {
  src: string;
  alt: string;
};

export function GuideImage({ src, alt }: Props) {
  return (
    <div className="mt-3 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} className="h-auto w-full object-contain" />
    </div>
  );
}

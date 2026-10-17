const companies = [
  { name: "Amazon", src: "/companies/amazon.svg" },
  { name: "Google", src: "/companies/google.svg" },
  { name: "Microsoft", src: "/companies/microsoft.svg" },
  { name: "Apple", src: "/companies/apple.svg" },
  { name: "Meta", src: "/companies/meta.svg" },
  { name: "Netflix", src: "/companies/netflix.svg" },
  { name: "Shopify", src: "/companies/shopify.svg" },
  { name: "Salesforce", src: "/companies/salesforce.svg" },
  { name: "IBM", src: "/companies/ibm.svg" },
  { name: "Dell", src: "/companies/dell.svg" },
  { name: "Spotify", src: "/companies/spotify.svg" },
  { name: "Zoom", src: "/companies/zoom.svg" },
];

function LogoRow({ copy, hidden = false }: { copy: string; hidden?: boolean }) {
  return (
    <>
      {companies.map((company) => (
        <li
          key={`${copy}-${company.name}`}
          aria-hidden={hidden || undefined}
          className="flex h-16 w-40 shrink-0 items-center justify-center px-4"
        >
          <img
            src={company.src}
            alt={hidden ? "" : company.name}
            className="max-h-8 w-auto max-w-[8.5rem] object-contain"
          />
        </li>
      ))}
    </>
  );
}

export function CompanySlider() {
  return (
    <section aria-label="Popular companies that hire remotely" className="border-y border-slate-200 bg-white">
      <p className="px-4 pt-5 text-center text-xs font-medium tracking-wide text-slate-500 uppercase">
        Popular companies that hire remotely
      </p>
      <div className="overflow-hidden py-4">
        <ul className="company-track flex w-max items-center">
          <LogoRow copy="a" />
          <LogoRow copy="b" hidden />
        </ul>
      </div>
    </section>
  );
}

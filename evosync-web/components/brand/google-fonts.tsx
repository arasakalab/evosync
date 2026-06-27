/**
 * Componente que injeta um <link rel="stylesheet"> pra Google Fonts
 * dinamicamente na landing /c/[slug]. Usado pra carregar a fonte
 * escolhida pelo tenant (Inter, Roboto ou Poppins).
 */
export function GoogleFontsLink({ href }: { href: string }) {
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link rel="stylesheet" href={href} />
    </>
  );
}

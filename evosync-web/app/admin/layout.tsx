/**
 * Layout dedicado pra /admin/* — bypassa o AppShell (sem sidebar/header).
 *
 * Páginas de login e admin panel merecem tela cheia, sem o chrome
 * do app principal. Isso evita também que a página de login role
 * com o header + statusbar somando ~100px de chrome.
 */
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

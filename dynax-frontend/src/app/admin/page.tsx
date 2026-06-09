import { PortalAuth } from '@/components/auth/PortalAuth';

export const metadata = {
  title: 'Admin — DynaX',
  robots: { index: false, follow: false },
};

export default function AdminPortal() {
  return (
    <PortalAuth
      title="Administrator sign in"
      subtitle="Restricted access. Authorized personnel only."
      allowedRoles={['admin']}
      accent="slate"
      secure
    />
  );
}

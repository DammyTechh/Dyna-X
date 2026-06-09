import { PortalAuth } from '@/components/auth/PortalAuth';

export const metadata = {
  title: 'Prosthetist & Orthotist Portal — DynaX',
  description: 'Sign in to the DynaX Prosthetist & Orthotist clinical workspace.',
};

export default function ProsthetistOrthotistPortal() {
  return (
    <PortalAuth
      title="Prosthetist & Orthotist"
      subtitle="Sign in to your P&O clinical workspace and 3D scan editor."
      allowedRoles={['prosthetist', 'orthotist']}
      registerRoles={[
        { value: 'prosthetist', label: 'Prosthetist' },
        { value: 'orthotist', label: 'Orthotist' },
      ]}
      accent="teal"
    />
  );
}

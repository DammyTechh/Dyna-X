import { PortalAuth } from '@/components/auth/PortalAuth';

export const metadata = {
  title: 'Physiotherapy Portal — DynaX',
  description: 'Sign in to the DynaX Physiotherapy clinical workspace.',
};

export default function PhysiotherapyPortal() {
  return (
    <PortalAuth
      title="Physiotherapy"
      subtitle="Sign in to your physiotherapy clinical workspace."
      allowedRoles={['physiotherapist']}
      registerRoles={[{ value: 'physiotherapist', label: 'Physiotherapist' }]}
      accent="blue"
    />
  );
}

import { Compass } from 'lucide-react';
import { useAuth, homeFor } from '../context/auth.js';
import { ButtonLink } from '../components/ui/Button.jsx';
import { Logo } from '../components/ui/Misc.jsx';

export function NotFoundPage() {
  const { user } = useAuth();
  return (
    <main className="campus-grid grid min-h-dvh place-items-center bg-navy-900 px-4 text-white">
      <div className="flex max-w-md flex-col items-center text-center">
        <Logo light />
        <div className="mt-10 grid size-20 place-items-center rounded-full bg-white/10 text-gold-300">
          <Compass className="size-10" aria-hidden />
        </div>
        <p className="mt-6 text-sm font-bold tracking-widest text-gold-300 uppercase">Error 404</p>
        <h1 className="mt-2 text-3xl font-extrabold">This corner of campus is empty</h1>
        <p className="mt-3 text-[#C5CEE2]">
          The page you are looking for does not exist or has moved.
        </p>
        <ButtonLink to={homeFor(user)} variant="gold" size="lg" className="mt-8">
          {user ? 'Back to FixIt Campus' : 'Go to sign in'}
        </ButtonLink>
      </div>
    </main>
  );
}

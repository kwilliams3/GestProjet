import { useApi } from '../hooks.js';
import { GoogleLogo, MicrosoftLogo } from './icons.jsx';

const LOGOS = { google: GoogleLogo, microsoft: MicrosoftLogo };

/** Boutons « Continuer avec Google / Microsoft », affichés seulement si le serveur les a configurés. */
export default function SsoButtons() {
  const { data: providers } = useApi('/auth/providers');
  if (!providers?.length) return null;

  return (
    <div className="sso">
      <p className="divider">
        <span>ou</span>
      </p>
      {providers.map((provider) => {
        const Logo = LOGOS[provider.id];
        return (
          // Navigation complète (et non un appel fetch) : le serveur redirige vers la page du fournisseur.
          <a key={provider.id} className="btn btn-lg btn-block sso-button" href={`/api/auth/sso/${provider.id}`}>
            {Logo && <Logo />}
            Continuer avec {provider.label}
          </a>
        );
      })}
    </div>
  );
}

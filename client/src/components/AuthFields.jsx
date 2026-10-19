import { useId, useState } from 'react';
import { EyeIcon, EyeOffIcon, LockIcon } from './icons.jsx';

/** Champ des écrans d'accès : libellé, icône dans le champ, aide facultative. */
export function TextField({ label, icon: FieldIcon, hint, ...inputProps }) {
  const id = useId();
  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <div className="input-group">
        {FieldIcon && <FieldIcon className="input-icon" />}
        <input id={id} aria-describedby={hint ? `${id}-aide` : undefined} {...inputProps} />
      </div>
      {hint && (
        <span id={`${id}-aide`} className="field-hint">
          {hint}
        </span>
      )}
    </div>
  );
}

/** Mot de passe avec bouton pour l'afficher ou le masquer. */
export function PasswordField({ label = 'Mot de passe', hint, ...inputProps }) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <div className="input-group">
        <LockIcon className="input-icon" />
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          className="has-action"
          aria-describedby={hint ? `${id}-aide` : undefined}
          {...inputProps}
        />
        <button
          type="button"
          className="input-action"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
          aria-pressed={visible}
        >
          {visible ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
      {hint && (
        <span id={`${id}-aide`} className="field-hint">
          {hint}
        </span>
      )}
    </div>
  );
}

export function SubmitButton({ busy, busyLabel, children }) {
  return (
    <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={busy}>
      {busy && <span className="spinner" aria-hidden="true" />}
      {busy ? busyLabel : children}
    </button>
  );
}
